var PersonalCfoDomain = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/features/personal-cfo/snapshot.ts
	var CURRENT_SCHEMA_VERSION = 3;
	var legacySeedIds = {
		budgetBuckets: /* @__PURE__ */ new Set([
			"operating",
			"defense",
			"housing",
			"growth",
			"humanCapital",
			"experience"
		]),
		projects: /* @__PURE__ */ new Set(["project:changneung", "project:online-master"]),
		risks: /* @__PURE__ */ new Set([
			"risk:job-loss",
			"risk:interest-rate",
			"risk:market-drawdown",
			"risk:health",
			"risk:liquidity"
		]),
		kpis: /* @__PURE__ */ new Set([
			"kpi:net-worth",
			"kpi:savings-rate",
			"kpi:free-cash-flow",
			"kpi:fixed-cost-ratio",
			"kpi:emergency-coverage",
			"kpi:debt-ratio"
		])
	};
	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}
	function record(value) {
		return value && typeof value === "object" && !Array.isArray(value) ? value : {};
	}
	function items(value) {
		if (!Array.isArray(value)) return [];
		return clone(value.filter((item) => item && typeof item === "object" && !Array.isArray(item) && String(item.id || "").trim()));
	}
	function withoutLegacySeeds(values, ids, schemaVersion) {
		if (schemaVersion >= CURRENT_SCHEMA_VERSION) return values;
		return values.filter((item) => !ids.has(String(item.id || "")));
	}
	function createEmptyPersonalCfoSnapshot() {
		return {
			person: {
				id: "person:me",
				label: "나"
			},
			dataSources: [{
				id: "source:portfolio",
				label: "포트폴리오 데이터",
				type: "portfolioData",
				description: "Finance 포트폴리오의 현재 계좌, 자산, 부채를 사용합니다."
			}, {
				id: "source:cashflow",
				label: "현금흐름 데이터",
				type: "financeData",
				description: "최근 종료 급여기간의 거래를 사용합니다."
			}],
			incomes: [],
			accounts: [],
			assets: [],
			liabilities: [],
			budgetBuckets: [],
			projects: [],
			risks: [],
			kpis: []
		};
	}
	function normalizePersonalCfoPlanSnapshot(value, schemaVersion = CURRENT_SCHEMA_VERSION) {
		const source = record(value);
		const person = record(source.person);
		const empty = createEmptyPersonalCfoSnapshot();
		return {
			...empty,
			person: {
				id: String(person.id || empty.person.id),
				label: String(person.label || empty.person.label)
			},
			budgetBuckets: withoutLegacySeeds(items(source.budgetBuckets), legacySeedIds.budgetBuckets, schemaVersion),
			projects: withoutLegacySeeds(items(source.projects), legacySeedIds.projects, schemaVersion),
			risks: withoutLegacySeeds(items(source.risks), legacySeedIds.risks, schemaVersion),
			kpis: withoutLegacySeeds(items(source.kpis), legacySeedIds.kpis, schemaVersion)
		};
	}
	//#endregion
	//#region src/features/personal-cfo/calculations.ts
	function sum$1(values) {
		return values.reduce((total, value) => total + value, 0);
	}
	function clamp(value, min = 0, max = 100) {
		return Math.max(min, Math.min(max, value));
	}
	function calculateTotalAssets(snapshot) {
		return sum$1(snapshot.accounts.map((account) => account.balance)) + sum$1(snapshot.assets.map((asset) => asset.marketValue));
	}
	function calculateTotalLiabilities(snapshot) {
		return sum$1(snapshot.liabilities.map((liability) => liability.outstandingBalance));
	}
	function calculateNetWorth(snapshot) {
		return calculateTotalAssets(snapshot) - calculateTotalLiabilities(snapshot);
	}
	function calculateMonthlyFreeCashFlow(snapshot) {
		if (snapshot.cashFlow) return snapshot.cashFlow.freeCashFlow;
		const income = sum$1(snapshot.incomes.map((item) => item.monthlyAmount));
		const allocations = sum$1(snapshot.budgetBuckets.map((bucket) => bucket.monthlyAllocation));
		const debtPayments = sum$1(snapshot.liabilities.map((liability) => liability.monthlyPayment));
		return income - allocations - debtPayments;
	}
	function calculateSavingsRate(snapshot) {
		const income = sum$1(snapshot.incomes.map((item) => item.monthlyAmount));
		if (income <= 0) return 0;
		return clamp(sum$1(snapshot.budgetBuckets.filter((bucket) => [
			"defense",
			"housing",
			"growth",
			"humanCapital"
		].includes(bucket.id)).map((bucket) => bucket.monthlyAllocation)) / income * 100);
	}
	function calculateFixedCostRatio(snapshot) {
		if (snapshot.cashFlow) {
			if (snapshot.cashFlow.totalIncome <= 0) return 0;
			return clamp((snapshot.cashFlow.fixedExpense + snapshot.cashFlow.debtRepayment) / snapshot.cashFlow.totalIncome * 100);
		}
		const income = sum$1(snapshot.incomes.map((item) => item.monthlyAmount));
		if (income <= 0) return 0;
		return clamp((sum$1(snapshot.budgetBuckets.map((bucket) => bucket.fixedCostAmount)) + sum$1(snapshot.liabilities.map((liability) => liability.monthlyPayment))) / income * 100);
	}
	function calculateDebtRatio(snapshot) {
		const assets = calculateTotalAssets(snapshot);
		if (assets <= 0) return 0;
		return clamp(calculateTotalLiabilities(snapshot) / assets * 100);
	}
	function calculateEmergencyCoverageMonths(snapshot) {
		const defenseBalance = sum$1(snapshot.budgetBuckets.filter((bucket) => bucket.id === "defense").map((bucket) => bucket.currentBalance));
		const essentialMonthlyCost = sum$1(snapshot.budgetBuckets.filter((bucket) => [
			"operating",
			"defense",
			"housing"
		].includes(bucket.id)).map((bucket) => bucket.fixedCostAmount)) + sum$1(snapshot.liabilities.map((liability) => liability.monthlyPayment));
		if (essentialMonthlyCost <= 0) return 0;
		return defenseBalance / essentialMonthlyCost;
	}
	function calculateProjectBurnRate(snapshot) {
		return sum$1(snapshot.projects.filter((project) => project.status === "active").map((project) => project.monthlyBurn));
	}
	function calculateRiskScore(risk) {
		const baseScore = risk.likelihood * .45 + risk.impact * .55;
		const exposureBoost = Math.min(20, Math.log10(Math.max(1, risk.exposureAmount)) * 2);
		return Math.round(clamp(baseScore + exposureBoost));
	}
	function calculateProjectPriorityScore(project) {
		const fundingProgress = project.targetAmount > 0 ? clamp(project.currentAmount / project.targetAmount * 100) : 0;
		const burnPenalty = Math.min(18, project.monthlyBurn / 6e4);
		const statusPenalty = project.status === "completed" ? 35 : project.status === "paused" ? 20 : 0;
		return Math.round(clamp(project.strategicImportance * .32 + project.urgency * .24 + project.expectedReturn * .2 + project.riskReduction * .14 + fundingProgress * .1 - burnPenalty - statusPenalty));
	}
	function getBucketFundingProgress(bucket) {
		if (!bucket.targetBalance || bucket.targetBalance <= 0) return 0;
		return clamp(bucket.currentBalance / bucket.targetBalance * 100);
	}
	function buildPersonalCfoKpiSummary(snapshot) {
		const savingPlanBuckets = snapshot.budgetBuckets.filter((bucket) => [
			"defense",
			"housing",
			"growth",
			"humanCapital"
		].includes(bucket.id));
		const emergencyPlanBuckets = snapshot.budgetBuckets.filter((bucket) => [
			"operating",
			"defense",
			"housing"
		].includes(bucket.id));
		return {
			totalAssets: calculateTotalAssets(snapshot),
			totalLiabilities: calculateTotalLiabilities(snapshot),
			netWorth: calculateNetWorth(snapshot),
			monthlyFreeCashFlow: calculateMonthlyFreeCashFlow(snapshot),
			savingsRate: calculateSavingsRate(snapshot),
			fixedCostRatio: calculateFixedCostRatio(snapshot),
			debtRatio: calculateDebtRatio(snapshot),
			emergencyCoverageMonths: calculateEmergencyCoverageMonths(snapshot),
			projectBurnRate: calculateProjectBurnRate(snapshot),
			cashFlowReviewStatus: snapshot.cashFlow?.reviewStatus || "unconfirmed",
			hasSavingsPlan: savingPlanBuckets.length > 0,
			hasEmergencyPlan: emergencyPlanBuckets.length > 0,
			hasPlanningData: snapshot.budgetBuckets.length > 0 || snapshot.projects.length > 0 || snapshot.risks.length > 0 || snapshot.kpis.length > 0
		};
	}
	//#endregion
	//#region src/features/personal-cfo/cashFlowAdapter.ts
	function sum(values) {
		return values.reduce((total, value) => total + Number(value || 0), 0);
	}
	function emptyBucketOutflows() {
		return {
			operating: 0,
			defense: 0,
			housing: 0,
			growth: 0,
			humanCapital: 0,
			experience: 0
		};
	}
	function resolveExpenseBucket(transaction) {
		const text = `${String(transaction.category || "").trim()} ${String(transaction.subcategory || "").trim()} ${transaction.memo || ""}`;
		if (/교육|학습|시험|강의|교재/u.test(text)) return "humanCapital";
		if (/여행|숙박|취미|여가/u.test(text)) return "experience";
		if (/전세|월세|주거|관리비/u.test(text)) return "housing";
		if (/보험|의료|건강|약국|병원/u.test(text)) return "defense";
		return "operating";
	}
	function resolveSavingBucket(transaction) {
		const text = `${transaction.memo || ""} ${transaction.method || ""}`;
		if (/청약|주택/u.test(text)) return "housing";
		if (/증권|ISA|ETF|주식|투자/u.test(text)) return "growth";
		return "defense";
	}
	function summarizeCashFlowPeriod(period) {
		const bucketOutflows = emptyBucketOutflows();
		const incomes = period.transactions.filter((item) => item.type === "수입");
		const expenses = period.transactions.filter((item) => item.type === "지출");
		const savingTransfers = period.transactions.filter((item) => item.type === "이체" && item.category === "저축" && Number(item.amount) < 0);
		expenses.forEach((item) => {
			if (item.category === "상환") return;
			bucketOutflows[resolveExpenseBucket(item)] += Math.abs(Number(item.amount || 0));
		});
		savingTransfers.forEach((item) => {
			bucketOutflows[resolveSavingBucket(item)] += Math.abs(Number(item.amount || 0));
		});
		const totalIncome = sum(incomes.map((item) => Number(item.amount || 0)));
		const totalExpense = sum(expenses.map((item) => Math.abs(Number(item.amount || 0))));
		const savingTotal = sum(savingTransfers.map((item) => Math.abs(Number(item.amount || 0))));
		const fixedExpense = sum(expenses.filter((item) => item.category === "고정비").map((item) => Math.abs(Number(item.amount || 0))));
		const debtRepayment = sum(expenses.filter((item) => item.category === "상환").map((item) => Math.abs(Number(item.amount || 0))));
		const dates = period.transactions.map((item) => item.date).filter(Boolean).sort();
		const freeCashFlow = totalIncome - totalExpense;
		return {
			periodKey: period.key,
			periodLabel: period.label,
			startDate: period.startDate,
			endDate: period.endDate,
			latestTransactionDate: dates[dates.length - 1] || period.endDate,
			reviewStatus: period.closeStatus || "unconfirmed",
			totalIncome,
			totalExpense,
			freeCashFlow,
			fixedExpense,
			debtRepayment,
			savingTransfers: savingTotal,
			unallocatedCash: freeCashFlow - savingTotal,
			bucketOutflows
		};
	}
	function selectLatestClosedCashFlow(periods, today) {
		const closed = periods.filter((period) => period.transactions.length > 0 && period.endDate < today).sort((a, b) => a.endDate.localeCompare(b.endDate));
		const fallback = periods.filter((period) => period.transactions.length > 0).sort((a, b) => a.endDate.localeCompare(b.endDate));
		const selected = closed[closed.length - 1] || fallback[fallback.length - 1];
		return selected ? summarizeCashFlowPeriod(selected) : void 0;
	}
	function applyCashFlowData(snapshot, periods, today) {
		const cashFlow = selectLatestClosedCashFlow(periods, today);
		if (!cashFlow) return snapshot;
		const primaryIncome = snapshot.incomes[0];
		const actualIncome = primaryIncome ? {
			...primaryIncome,
			label: `${cashFlow.periodLabel} 수입`,
			monthlyAmount: cashFlow.totalIncome
		} : {
			id: `income:cashflow:${cashFlow.periodKey}`,
			label: `${cashFlow.periodLabel} 수입`,
			monthlyAmount: cashFlow.totalIncome,
			stabilityScore: 100,
			sourceRefs: [{
				sourceId: "source:cashflow",
				entityType: "cashFlowPeriod",
				entityId: cashFlow.periodKey,
				field: "totalIncome"
			}]
		};
		return {
			...snapshot,
			cashFlow,
			incomes: [actualIncome, ...snapshot.incomes.slice(1)]
		};
	}
	//#endregion
	//#region src/features/personal-cfo/graphBuilder.ts
	var bucketNodeByKey = {
		operating: "bucket:operating",
		defense: "bucket:defense",
		housing: "bucket:housing",
		growth: "bucket:growth",
		humanCapital: "bucket:humanCapital",
		experience: "bucket:experience"
	};
	var cashFlowBucketMeta = {
		operating: "운영자금",
		defense: "방어자금",
		housing: "주거자금",
		growth: "성장자금",
		humanCapital: "인적자본",
		experience: "경험자금"
	};
	var cashFlowBucketOrder = Object.keys(cashFlowBucketMeta);
	function amountToNodeSize(amount = 0) {
		if (amount <= 0) return 18;
		return Math.round(Math.min(30, 12 + Math.log10(amount) * 2.25));
	}
	function amountToEdgeWeight(amount = 0) {
		if (amount <= 0) return 1.2;
		return Number(Math.min(4.5, 1.2 + Math.log10(amount) * .38).toFixed(2));
	}
	function makeNode(params) {
		return {
			...params,
			size: amountToNodeSize(params.amount),
			opacity: params.status === "completed" ? .38 : 1
		};
	}
	function makeEdge(id, source, target, type, amount) {
		return {
			id,
			source,
			target,
			type,
			amount,
			weight: amountToEdgeWeight(amount)
		};
	}
	function buildCashFlowGraph(snapshot) {
		const nodes = [];
		const edges = [];
		const outflowBuckets = snapshot.cashFlow ? cashFlowBucketOrder.map((id) => ({
			id,
			label: cashFlowBucketMeta[id],
			amount: snapshot.cashFlow?.bucketOutflows[id] || 0
		})).filter((bucket) => bucket.amount > 0) : snapshot.budgetBuckets.map((bucket) => ({
			id: bucket.id,
			label: bucket.label,
			amount: bucket.monthlyAllocation
		}));
		const outflowX = 790;
		const topY = 92;
		const bucketStartY = topY;
		const bucketGap = 84;
		nodes.push(makeNode({
			id: snapshot.person.id,
			label: snapshot.person.label,
			type: "person",
			x: 390,
			y: topY,
			amount: snapshot.cashFlow?.totalIncome ?? snapshot.incomes.reduce((sum, item) => sum + item.monthlyAmount, 0)
		}));
		snapshot.incomes.forEach((income, index) => {
			nodes.push(makeNode({
				id: income.id,
				label: income.label,
				type: "income",
				x: 115,
				y: topY + index * 84,
				amount: income.monthlyAmount
			}));
			edges.push(makeEdge(`edge:${income.id}:person`, income.id, snapshot.person.id, "FLOWS_TO", income.monthlyAmount));
		});
		outflowBuckets.forEach((bucket, index) => {
			const amount = bucket.amount;
			nodes.push(makeNode({
				id: bucketNodeByKey[bucket.id],
				label: bucket.label,
				type: "budgetBucket",
				x: outflowX,
				y: bucketStartY + index * bucketGap,
				amount,
				bucketKey: bucket.id
			}));
			if (amount > 0) edges.push(makeEdge(`edge:person:${bucket.id}`, snapshot.person.id, bucketNodeByKey[bucket.id], "ALLOCATED_TO", amount));
		});
		const residual = snapshot.cashFlow?.unallocatedCash ?? calculateMonthlyFreeCashFlow(snapshot);
		const debtRepayment = snapshot.cashFlow?.debtRepayment ?? 0;
		if (debtRepayment > 0) {
			nodes.push(makeNode({
				id: "liability:monthly-debt-payment",
				label: "부채 상환",
				type: "liability",
				x: outflowX,
				y: bucketStartY + outflowBuckets.length * bucketGap,
				amount: debtRepayment,
				riskScore: 62
			}));
			edges.push(makeEdge("edge:person:debt-payment", snapshot.person.id, "liability:monthly-debt-payment", "FLOWS_TO", debtRepayment));
		}
		const residualId = residual >= 0 ? "account:unallocated-cash" : "liability:cash-deficit";
		nodes.push(makeNode({
			id: residualId,
			label: residual >= 0 ? "저축 후 미배분" : "초과 지출",
			type: residual >= 0 ? "account" : "liability",
			x: outflowX,
			y: bucketStartY + (outflowBuckets.length + (debtRepayment > 0 ? 1 : 0)) * bucketGap,
			amount: Math.abs(residual),
			riskScore: residual < 0 ? 85 : void 0
		}));
		edges.push(residual >= 0 ? makeEdge("edge:person:unallocated", snapshot.person.id, residualId, "FLOWS_TO", residual) : makeEdge("edge:deficit:person", residualId, snapshot.person.id, "EXPOSED_TO", Math.abs(residual)));
		const laneYs = nodes.filter((node) => node.x === outflowX).map((node) => node.y);
		return {
			mode: "cashFlow",
			width: 1020,
			height: Math.max(620, Math.max(...laneYs) + 72),
			columns: [
				{
					x: 115,
					label: "수입"
				},
				{
					x: 390,
					label: "사용 가능 현금"
				},
				{
					x: outflowX,
					label: "실제 유출·잔여"
				}
			],
			laneYs,
			nodes,
			edges
		};
	}
	function buildBalanceSheetGraph(snapshot) {
		const nodes = [];
		const edges = [];
		const accountX = 170;
		const personX = 600;
		const assetX = 1030;
		const topY = 92;
		const personY = topY;
		const accountYs = [
			topY,
			220,
			348,
			476
		];
		const assetYs = [
			topY,
			250,
			408
		];
		nodes.push(makeNode({
			id: snapshot.person.id,
			label: snapshot.person.label,
			type: "person",
			x: personX,
			y: personY,
			amount: calculateNetWorth(snapshot)
		}));
		snapshot.accounts.forEach((account, index) => {
			nodes.push(makeNode({
				id: account.id,
				label: account.label,
				type: "account",
				x: accountX,
				y: accountYs[index] ?? topY + index * 128,
				amount: account.balance,
				bucketKey: account.bucketKey
			}));
			edges.push(makeEdge(`edge:${account.id}:person`, account.id, snapshot.person.id, "CONTRIBUTES_TO", account.balance));
		});
		snapshot.assets.forEach((asset, index) => {
			nodes.push(makeNode({
				id: asset.id,
				label: asset.label,
				type: "asset",
				x: assetX,
				y: assetYs[index] ?? topY + index * 158,
				amount: asset.marketValue,
				bucketKey: asset.bucketKey,
				riskScore: asset.volatilityScore
			}));
			edges.push(makeEdge(`edge:${asset.id}:person`, asset.id, snapshot.person.id, "CONTRIBUTES_TO", asset.marketValue));
		});
		snapshot.liabilities.forEach((liability, index) => {
			nodes.push(makeNode({
				id: liability.id,
				label: liability.label,
				type: "liability",
				x: personX + (index - (snapshot.liabilities.length - 1) / 2) * 180,
				y: 242,
				amount: liability.outstandingBalance,
				riskScore: liability.riskScore
			}));
			edges.push(makeEdge(`edge:${liability.id}:person`, liability.id, snapshot.person.id, "EXPOSED_TO", liability.outstandingBalance));
		});
		return {
			mode: "balanceSheet",
			width: 1200,
			height: 580,
			columns: [
				{
					x: accountX,
					label: "계좌"
				},
				{
					x: personX,
					label: "순자산"
				},
				{
					x: assetX,
					label: "보유자산"
				}
			],
			nodes,
			edges
		};
	}
	function buildStrategyGraph(snapshot) {
		const nodes = [];
		const edges = [];
		const personX = 110;
		const bucketX = 430;
		const targetX = 900;
		const topY = 92;
		const bucketStartY = topY;
		const bucketGap = 110;
		const bucketYByKey = /* @__PURE__ */ new Map();
		nodes.push(makeNode({
			id: snapshot.person.id,
			label: snapshot.person.label,
			type: "person",
			x: personX,
			y: topY,
			amount: calculateNetWorth(snapshot)
		}));
		snapshot.budgetBuckets.forEach((bucket, index) => {
			const y = bucketStartY + index * bucketGap;
			bucketYByKey.set(bucket.id, y);
			nodes.push(makeNode({
				id: bucketNodeByKey[bucket.id],
				label: bucket.label,
				type: "budgetBucket",
				x: bucketX,
				y,
				amount: bucket.currentBalance,
				bucketKey: bucket.id
			}));
			edges.push(makeEdge(`edge:person:${bucket.id}`, snapshot.person.id, bucketNodeByKey[bucket.id], "ALLOCATED_TO", bucket.monthlyAllocation));
		});
		const targetsByBucket = /* @__PURE__ */ new Map();
		snapshot.projects.forEach((project) => {
			const targets = targetsByBucket.get(project.bucketKey) ?? [];
			targets.push({
				id: project.id,
				label: project.label,
				type: "project",
				amount: project.targetAmount,
				status: project.status
			});
			targetsByBucket.set(project.bucketKey, targets);
			edges.push(makeEdge(`edge:${project.bucketKey}:${project.id}`, bucketNodeByKey[project.bucketKey], project.id, "FUNDS", project.monthlyBurn));
		});
		snapshot.risks.forEach((risk) => {
			if (!risk.mitigatedByBucket) return;
			const targets = targetsByBucket.get(risk.mitigatedByBucket) ?? [];
			targets.push({
				id: risk.id,
				label: risk.label,
				type: "risk",
				amount: risk.exposureAmount,
				riskScore: calculateRiskScore(risk)
			});
			targetsByBucket.set(risk.mitigatedByBucket, targets);
			edges.push(makeEdge(`edge:${risk.mitigatedByBucket}:${risk.id}`, bucketNodeByKey[risk.mitigatedByBucket], risk.id, "HEDGES", risk.exposureAmount));
		});
		targetsByBucket.forEach((targets, bucketKey) => {
			const baseY = bucketYByKey.get(bucketKey) ?? 355;
			targets.forEach((target, index) => {
				const y = baseY + (index - (targets.length - 1) / 2) * 62;
				nodes.push(makeNode({
					...target,
					x: targetX,
					y,
					bucketKey
				}));
			});
		});
		return {
			mode: "strategy",
			width: 1080,
			height: Math.max(620, Math.max(...bucketYByKey.values()) + 80),
			columns: [
				{
					x: personX,
					label: "본인"
				},
				{
					x: bucketX,
					label: "자금 바구니"
				},
				{
					x: targetX,
					label: "프로젝트·리스크"
				}
			],
			laneYs: Array.from(bucketYByKey.values()),
			nodes,
			edges
		};
	}
	function buildFinanceGraphFromSnapshot(snapshot, mode = "balanceSheet") {
		if (mode === "balanceSheet") return buildBalanceSheetGraph(snapshot);
		if (mode === "strategy") return buildStrategyGraph(snapshot);
		return buildCashFlowGraph(snapshot);
	}
	//#endregion
	//#region src/features/personal-cfo/PersonalCfoPage.tsx
	function createPersonalCfoPageModel(snapshot, graphMode = "balanceSheet") {
		return {
			snapshot,
			summary: buildPersonalCfoKpiSummary(snapshot),
			graph: buildFinanceGraphFromSnapshot(snapshot, graphMode),
			projectsByPriority: snapshot.projects.map((project) => ({
				...project,
				priorityScore: calculateProjectPriorityScore(project)
			})).sort((a, b) => b.priorityScore - a.priorityScore),
			risksByScore: snapshot.risks.map((risk) => ({
				...risk,
				score: calculateRiskScore(risk)
			})).sort((a, b) => b.score - a.score)
		};
	}
	function PersonalCfoPage(snapshot) {
		const model = createPersonalCfoPageModel(snapshot);
		return `개인 CFO 대시보드: 노드 ${model.graph.nodes.length}개, 연결 ${model.graph.edges.length}개`;
	}
	//#endregion
	//#region src/features/personal-cfo/portfolioAdapter.ts
	var accountMeta = {
		operating: {
			label: "생활계좌",
			liquidityScore: 95
		},
		defense: {
			label: "안전자산 계좌",
			liquidityScore: 70
		},
		housing: {
			label: "청약통장",
			liquidityScore: 60
		},
		growth: {
			label: "증권계좌 현금",
			liquidityScore: 85
		},
		humanCapital: {
			label: "인적자본 계좌",
			liquidityScore: 80
		},
		experience: {
			label: "경험자금 계좌",
			liquidityScore: 80
		}
	};
	function toSourceRefs(items) {
		return items.filter((item) => item.id).map((item) => ({
			sourceId: "source:portfolio",
			entityType: "portfolio",
			entityId: String(item.id),
			field: "amount"
		}));
	}
	function getAccountBucket(item) {
		const group = item.groupName.toLowerCase();
		const text = `${item.groupName} ${item.name} ${item.accountName ?? ""} ${item.instrumentType ?? ""}`.toLowerCase();
		if (/청약|주택드림/.test(text)) return "housing";
		if (/투자/.test(group) || /증권|isa|brokerage/.test(text)) return "growth";
		if (/안전|예금|적금|발행어음|ima|도약|rp|cma|채권/.test(text)) return "defense";
		return "operating";
	}
	function aggregateAccounts(items) {
		const grouped = /* @__PURE__ */ new Map();
		items.forEach((item) => {
			const bucket = getAccountBucket(item);
			grouped.set(bucket, [...grouped.get(bucket) ?? [], item]);
		});
		return [
			"operating",
			"defense",
			"housing",
			"growth"
		].filter((bucket) => grouped.has(bucket)).map((bucket) => {
			const rows = grouped.get(bucket) ?? [];
			const meta = accountMeta[bucket];
			return {
				id: `account:portfolio:${bucket}`,
				label: `${meta.label} ${rows.length}개`,
				balance: rows.reduce((total, item) => total + Math.max(0, Number(item.amount || 0)), 0),
				liquidityScore: meta.liquidityScore,
				bucketKey: bucket,
				sourceRefs: toSourceRefs(rows)
			};
		});
	}
	function normalizeLiabilityLabel(label) {
		return label.replace(/^가계일반자금대출\(일시상환\)-/u, "") || label;
	}
	function mapLiabilities(items) {
		return items.map((item, index) => {
			const outstandingBalance = Math.abs(Number(item.amount || 0));
			return {
				id: `liability:portfolio:${item.id || index + 1}`,
				label: normalizeLiabilityLabel(item.name),
				outstandingBalance,
				monthlyPayment: 0,
				interestRate: 0,
				riskScore: Math.round(Math.min(80, 40 + outstandingBalance / 2e6)),
				sourceRefs: toSourceRefs([item])
			};
		});
	}
	function getAssetGroup(item) {
		const text = `${item.groupName} ${item.name} ${item.assetType ?? ""} ${item.instrumentType ?? ""}`.toLowerCase();
		if (/연금|퇴직|pension/u.test(text)) return {
			key: "pension",
			label: "연금·퇴직자산",
			bucketKey: "growth",
			volatilityScore: 30
		};
		if (/주식|etf|펀드|채권|stock|equity|fund/u.test(text)) return {
			key: "investment",
			label: "투자자산",
			bucketKey: "growth",
			volatilityScore: 52
		};
		if (/전세|보증금|부동산|housing/u.test(text)) return {
			key: "housing",
			label: "주거자산",
			bucketKey: "housing",
			volatilityScore: 18
		};
		return {
			key: "other",
			label: "기타 보유자산",
			bucketKey: "defense",
			volatilityScore: 24
		};
	}
	function aggregateAssets(items) {
		const grouped = /* @__PURE__ */ new Map();
		items.forEach((item) => {
			const meta = getAssetGroup(item);
			const entry = grouped.get(meta.key) ?? {
				meta,
				items: []
			};
			entry.items.push(item);
			grouped.set(meta.key, entry);
		});
		return Array.from(grouped.entries()).map(([key, entry]) => ({
			id: `asset:portfolio:${key}`,
			label: `${entry.meta.label} ${entry.items.length}개`,
			marketValue: entry.items.reduce((total, item) => total + Math.max(0, Number(item.amount || 0)), 0),
			bucketKey: entry.meta.bucketKey,
			volatilityScore: entry.meta.volatilityScore,
			sourceRefs: toSourceRefs(entry.items)
		}));
	}
	function applyPortfolioFinanceData(snapshot, items) {
		if (items.length === 0) return {
			snapshot,
			accountItemCount: 0,
			assetItemCount: 0,
			liabilityItemCount: 0,
			hasPortfolioData: false
		};
		const liabilityItems = items.filter((item) => item.assetType === "debt" || Number(item.amount) < 0);
		const accountItems = items.filter((item) => !liabilityItems.includes(item) && (item.assetType === "account" || /청약통장/u.test(item.name)));
		const assetItems = items.filter((item) => !liabilityItems.includes(item) && !accountItems.includes(item));
		return {
			snapshot: {
				...snapshot,
				accounts: aggregateAccounts(accountItems),
				assets: aggregateAssets(assetItems),
				liabilities: mapLiabilities(liabilityItems)
			},
			accountItemCount: accountItems.length,
			assetItemCount: assetItems.length,
			liabilityItemCount: liabilityItems.length,
			hasPortfolioData: true
		};
	}
	//#endregion
	//#region src/features/finance/paydayAccounting.ts
	var PAYDAY_OVERRIDES = Object.freeze({
		"2025-10": "2025-10-24",
		"2025-11": "2025-11-25",
		"2025-12": "2025-12-24",
		"2026-01": "2026-01-23",
		"2026-02": "2026-02-25",
		"2026-03": "2026-03-25",
		"2026-04": "2026-04-24",
		"2026-05": "2026-05-22",
		"2026-06": "2026-06-25",
		"2026-07": "2026-07-24",
		"2026-08": "2026-08-25",
		"2026-09": "2026-09-23",
		"2026-10": "2026-10-23",
		"2026-11": "2026-11-25",
		"2026-12": "2026-12-24",
		"2027-01": "2027-01-25"
	});
	function pad(value) {
		return String(value).padStart(2, "0");
	}
	function monthKey(year, month) {
		return `${year}-${pad(month)}`;
	}
	function shiftDate(dateKey, days) {
		const [year, month, day] = dateKey.split("-").map(Number);
		const date = new Date(Date.UTC(year, month - 1, day + days));
		return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
	}
	function normalizeDateKey(value) {
		const parts = String(value || "").trim().replace(/[./]/g, "-").replace(/\s/g, "").replace(/-$/, "").split("-").map(Number);
		if (parts.length < 3 || parts.some((part) => !Number.isFinite(part))) throw new Error(`INVALID_ACCOUNTING_DATE: ${value}`);
		return `${parts[0]}-${pad(parts[1])}-${pad(parts[2])}`;
	}
	function getPaydayDate(year, month) {
		const override = PAYDAY_OVERRIDES[monthKey(year, month)];
		if (override) return override;
		const weekday = new Date(Date.UTC(year, month - 1, 25)).getUTCDay();
		const day = weekday === 6 ? 24 : weekday === 0 ? 23 : 25;
		return `${year}-${pad(month)}-${pad(day)}`;
	}
	function getPaydayAccountingPeriod(value) {
		const dateKey = normalizeDateKey(value);
		const [year, month] = dateKey.split("-").map(Number);
		const currentPayday = getPaydayDate(year, month);
		let accountingYear;
		let accountingMonth;
		let periodStart;
		let nextPayday;
		if (dateKey >= currentPayday) {
			accountingYear = month === 12 ? year + 1 : year;
			accountingMonth = month === 12 ? 1 : month + 1;
			periodStart = currentPayday;
			nextPayday = getPaydayDate(accountingYear, accountingMonth);
		} else {
			accountingYear = year;
			accountingMonth = month;
			periodStart = getPaydayDate(month === 1 ? year - 1 : year, month === 1 ? 12 : month - 1);
			nextPayday = currentPayday;
		}
		const periodEnd = shiftDate(nextPayday, -1);
		const [, startMonth, startDay] = periodStart.split("-").map(Number);
		const [, endMonth, endDay] = periodEnd.split("-").map(Number);
		return {
			monthKey: monthKey(accountingYear, accountingMonth),
			title: `${accountingYear}년 ${accountingMonth}월`,
			periodStart,
			periodEnd,
			periodStr: `${startMonth}/${startDay} ~ ${endMonth}/${endDay}`
		};
	}
	//#endregion
	//#region src/features/finance/monthlyClose.ts
	function text(value) {
		return String(value ?? "").trim();
	}
	function parseClassifications(value) {
		let source = value;
		if (typeof source === "string") try {
			source = JSON.parse(source);
		} catch (_error) {
			source = {};
		}
		if (!source || typeof source !== "object" || Array.isArray(source)) return {};
		return Object.entries(source).reduce((result, [key, raw]) => {
			if (!raw || typeof raw !== "object" || Array.isArray(raw)) return result;
			const item = raw;
			const transactionKey = text(item.transactionKey || item.transaction_key || key);
			if (!transactionKey) return result;
			result[transactionKey] = {
				transactionKey,
				type: text(item.type),
				category: text(item.category) || "미분류",
				subcategory: text(item.subcategory) || "미분류",
				updatedAt: text(item.updatedAt || item.updated_at)
			};
			return result;
		}, {});
	}
	function hash(value) {
		let result = 2166136261;
		for (let index = 0; index < value.length; index += 1) {
			result ^= value.charCodeAt(index);
			result = Math.imul(result, 16777619);
		}
		return (result >>> 0).toString(36);
	}
	function getCategory(transaction) {
		return text(transaction.category ?? transaction.cat) || "미분류";
	}
	function getSubcategory(transaction) {
		return text(transaction.subcategory ?? transaction.subcat) || "미분류";
	}
	function createTransactionKey(transaction) {
		const id = text(transaction.id);
		if (id) return `id:${id}`;
		return `legacy:${hash([
			transaction.date,
			transaction.time,
			transaction.type,
			getCategory(transaction),
			getSubcategory(transaction),
			transaction.memo,
			Math.round(Number(transaction.amount || 0)),
			transaction.method
		].map(text).join("|"))}`;
	}
	function createMonthlyCloseSourceRevision(transactions) {
		const source = transactions.map((transaction) => [
			createTransactionKey(transaction),
			transaction.date,
			transaction.time,
			transaction.type,
			getCategory(transaction),
			getSubcategory(transaction),
			transaction.memo,
			Number(transaction.amount || 0),
			transaction.method
		].map(text).join("|")).sort().join("|");
		return `${transactions.length}:${hash(source)}`;
	}
	function createFinanceMonthlyCloseRecord(periodKey, periodStart, periodEnd, updatedAt = "") {
		return {
			schemaVersion: 1,
			periodKey: text(periodKey),
			periodStart: text(periodStart),
			periodEnd: text(periodEnd),
			status: "open",
			classifications: {},
			transactionCount: 0,
			sourceRevision: "",
			reviewedAt: "",
			closedAt: "",
			updatedAt: text(updatedAt)
		};
	}
	function normalizeFinanceMonthlyCloseRecord(value, fallback = {}) {
		const source = value && typeof value === "object" && !Array.isArray(value) ? value : {};
		const statusValue = text(source.status || fallback.status);
		return {
			schemaVersion: 1,
			periodKey: text(source.periodKey || source.period_key || fallback.periodKey),
			periodStart: text(source.periodStart || source.period_start || fallback.periodStart),
			periodEnd: text(source.periodEnd || source.period_end || fallback.periodEnd),
			status: statusValue === "closed" ? "closed" : "open",
			classifications: parseClassifications(source.classifications || fallback.classifications),
			transactionCount: Math.max(0, Math.trunc(Number(source.transactionCount ?? source.transaction_count ?? fallback.transactionCount ?? 0))),
			sourceRevision: text(source.sourceRevision || source.source_revision || fallback.sourceRevision),
			reviewedAt: text(source.reviewedAt || source.reviewed_at || fallback.reviewedAt),
			closedAt: text(source.closedAt || source.closed_at || fallback.closedAt),
			updatedAt: text(source.updatedAt || source.updated_at || fallback.updatedAt)
		};
	}
	function applyFinanceMonthlyClose(transactions, record) {
		if (!record) return transactions.map((transaction) => ({ ...transaction }));
		return transactions.map((transaction) => {
			const override = record.classifications[createTransactionKey(transaction)];
			if (!override) return { ...transaction };
			return {
				...transaction,
				type: override.type,
				category: override.category,
				cat: override.category,
				subcategory: override.subcategory,
				subcat: override.subcategory
			};
		});
	}
	function isUnclassified(transaction) {
		const category = getCategory(transaction);
		return !text(transaction.type) || !category || category === "미분류";
	}
	function summarizeFinanceMonthlyClose(transactions, record) {
		const normalized = record ? normalizeFinanceMonthlyCloseRecord(record) : null;
		const effective = applyFinanceMonthlyClose(transactions, normalized);
		const sourceRevision = createMonthlyCloseSourceRevision(transactions);
		const unclassifiedCount = effective.filter(isUnclassified).length;
		const overrideCount = normalized ? Object.keys(normalized.classifications).length : 0;
		const isStale = normalized?.status === "closed" && normalized.sourceRevision !== sourceRevision;
		return {
			totalCount: transactions.length,
			reviewedCount: Math.max(0, transactions.length - unclassifiedCount),
			unclassifiedCount,
			overrideCount,
			sourceRevision,
			isStale,
			canClose: transactions.length > 0 && unclassifiedCount === 0
		};
	}
	function updateFinanceMonthlyCloseClassification(record, transaction, classification, updatedAt) {
		const normalized = normalizeFinanceMonthlyCloseRecord(record);
		if (normalized.status === "closed") throw new Error("CLOSED_MONTH_CANNOT_BE_EDITED");
		const transactionKey = createTransactionKey(transaction);
		const nextType = text(classification.type) || text(transaction.type);
		const nextCategory = text(classification.category) || "미분류";
		const nextSubcategory = text(classification.subcategory) || "미분류";
		const matchesSource = nextType === text(transaction.type) && nextCategory === getCategory(transaction) && nextSubcategory === getSubcategory(transaction);
		const classifications = { ...normalized.classifications };
		if (matchesSource) delete classifications[transactionKey];
		else classifications[transactionKey] = {
			transactionKey,
			type: nextType,
			category: nextCategory,
			subcategory: nextSubcategory,
			updatedAt: text(updatedAt)
		};
		return {
			...normalized,
			classifications,
			reviewedAt: text(updatedAt),
			updatedAt: text(updatedAt)
		};
	}
	function closeFinanceMonth(record, transactions, closedAt) {
		const normalized = normalizeFinanceMonthlyCloseRecord(record);
		const summary = summarizeFinanceMonthlyClose(transactions, normalized);
		if (!summary.canClose) throw new Error("UNCLASSIFIED_TRANSACTIONS_REMAIN");
		return {
			...normalized,
			status: "closed",
			transactionCount: summary.totalCount,
			sourceRevision: summary.sourceRevision,
			reviewedAt: normalized.reviewedAt || text(closedAt),
			closedAt: text(closedAt),
			updatedAt: text(closedAt)
		};
	}
	function reopenFinanceMonth(record, updatedAt) {
		return {
			...normalizeFinanceMonthlyCloseRecord(record),
			status: "open",
			closedAt: "",
			updatedAt: text(updatedAt)
		};
	}
	function canApplyConfirmedMonthlyClose(transactions, record) {
		if (!record || record.status !== "closed") return false;
		return !summarizeFinanceMonthlyClose(transactions, record).isStale;
	}
	//#endregion
	exports.PAYDAY_OVERRIDES = PAYDAY_OVERRIDES;
	exports.PersonalCfoPage = PersonalCfoPage;
	exports.applyCashFlowData = applyCashFlowData;
	exports.applyFinanceMonthlyClose = applyFinanceMonthlyClose;
	exports.applyPortfolioFinanceData = applyPortfolioFinanceData;
	exports.buildFinanceGraphFromSnapshot = buildFinanceGraphFromSnapshot;
	exports.buildPersonalCfoKpiSummary = buildPersonalCfoKpiSummary;
	exports.calculateDebtRatio = calculateDebtRatio;
	exports.calculateEmergencyCoverageMonths = calculateEmergencyCoverageMonths;
	exports.calculateFixedCostRatio = calculateFixedCostRatio;
	exports.calculateMonthlyFreeCashFlow = calculateMonthlyFreeCashFlow;
	exports.calculateNetWorth = calculateNetWorth;
	exports.calculateProjectBurnRate = calculateProjectBurnRate;
	exports.calculateProjectPriorityScore = calculateProjectPriorityScore;
	exports.calculateRiskScore = calculateRiskScore;
	exports.calculateSavingsRate = calculateSavingsRate;
	exports.calculateTotalAssets = calculateTotalAssets;
	exports.calculateTotalLiabilities = calculateTotalLiabilities;
	exports.canApplyConfirmedMonthlyClose = canApplyConfirmedMonthlyClose;
	exports.closeFinanceMonth = closeFinanceMonth;
	exports.createEmptyPersonalCfoSnapshot = createEmptyPersonalCfoSnapshot;
	exports.createFinanceMonthlyCloseRecord = createFinanceMonthlyCloseRecord;
	exports.createMonthlyCloseSourceRevision = createMonthlyCloseSourceRevision;
	exports.createPersonalCfoPageModel = createPersonalCfoPageModel;
	exports.createTransactionKey = createTransactionKey;
	exports.getBucketFundingProgress = getBucketFundingProgress;
	exports.getPaydayAccountingPeriod = getPaydayAccountingPeriod;
	exports.getPaydayDate = getPaydayDate;
	exports.normalizeFinanceMonthlyCloseRecord = normalizeFinanceMonthlyCloseRecord;
	exports.normalizePersonalCfoPlanSnapshot = normalizePersonalCfoPlanSnapshot;
	exports.reopenFinanceMonth = reopenFinanceMonth;
	exports.selectLatestClosedCashFlow = selectLatestClosedCashFlow;
	exports.summarizeCashFlowPeriod = summarizeCashFlowPeriod;
	exports.summarizeFinanceMonthlyClose = summarizeFinanceMonthlyClose;
	exports.updateFinanceMonthlyCloseClassification = updateFinanceMonthlyCloseClassification;
	return exports;
})({});

//# sourceMappingURL=personal-cfo-domain.js.map