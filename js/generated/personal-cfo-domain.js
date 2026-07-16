var PersonalCfoDomain = (function(exports) {
	Object.defineProperty(exports, Symbol.toStringTag, { value: "Module" });
	//#region src/features/personal-cfo/mockData.ts
	var defaultSourceRefs = {
		"income:salary": [{
			sourceId: "source:cashflow",
			entityType: "income",
			entityId: "salary",
			field: "monthlyAmount"
		}],
		"account:portfolio:operating": [{
			sourceId: "source:portfolio",
			entityType: "portfolio",
			field: "amount"
		}],
		"account:portfolio:defense": [{
			sourceId: "source:portfolio",
			entityType: "portfolio",
			field: "amount"
		}],
		"account:portfolio:housing": [{
			sourceId: "source:portfolio",
			entityType: "portfolio",
			field: "amount"
		}],
		"account:portfolio:growth": [{
			sourceId: "source:portfolio",
			entityType: "portfolio",
			field: "amount"
		}],
		"asset:etf": [{
			sourceId: "source:portfolio",
			entityType: "asset",
			entityId: "etf",
			field: "marketValue"
		}],
		"asset:pension": [{
			sourceId: "source:portfolio",
			entityType: "asset",
			entityId: "pension",
			field: "marketValue"
		}],
		"asset:housing-deposit": [{
			sourceId: "source:cashflow",
			entityType: "asset",
			entityId: "housing-deposit",
			field: "marketValue"
		}],
		"liability:portfolio:workplace-loan": [{
			sourceId: "source:portfolio",
			entityType: "portfolio",
			field: "amount"
		}],
		operating: [{
			sourceId: "source:cashflow",
			entityType: "budgetBucket",
			entityId: "operating",
			field: "monthlyAllocation"
		}, {
			sourceId: "source:manual",
			entityType: "budgetBucket",
			entityId: "operating",
			field: "targetBalance"
		}],
		defense: [{
			sourceId: "source:cashflow",
			entityType: "budgetBucket",
			entityId: "defense",
			field: "monthlyAllocation"
		}, {
			sourceId: "source:manual",
			entityType: "budgetBucket",
			entityId: "defense",
			field: "targetBalance"
		}],
		housing: [{
			sourceId: "source:cashflow",
			entityType: "budgetBucket",
			entityId: "housing",
			field: "monthlyAllocation"
		}, {
			sourceId: "source:manual",
			entityType: "budgetBucket",
			entityId: "housing",
			field: "targetBalance"
		}],
		growth: [{
			sourceId: "source:portfolio",
			entityType: "budgetBucket",
			entityId: "growth",
			field: "currentBalance"
		}, {
			sourceId: "source:manual",
			entityType: "budgetBucket",
			entityId: "growth",
			field: "targetBalance"
		}],
		humanCapital: [{
			sourceId: "source:life-todos",
			entityType: "budgetBucket",
			entityId: "humanCapital",
			field: "projectBudget"
		}],
		experience: [{
			sourceId: "source:manual",
			entityType: "budgetBucket",
			entityId: "experience",
			field: "monthlyAllocation"
		}],
		"project:changneung": [{
			sourceId: "source:life-todos",
			entityType: "project",
			entityId: "changneung",
			field: "status"
		}],
		"project:online-master": [{
			sourceId: "source:life-todos",
			entityType: "project",
			entityId: "online-master",
			field: "status"
		}],
		"risk:job-loss": [{
			sourceId: "source:manual",
			entityType: "risk",
			entityId: "job-loss",
			field: "exposureAmount"
		}],
		"risk:interest-rate": [{
			sourceId: "source:cashflow",
			entityType: "risk",
			entityId: "interest-rate",
			field: "exposureAmount"
		}],
		"risk:market-drawdown": [{
			sourceId: "source:portfolio",
			entityType: "risk",
			entityId: "market-drawdown",
			field: "exposureAmount"
		}],
		"risk:health": [{
			sourceId: "source:manual",
			entityType: "risk",
			entityId: "health",
			field: "impact"
		}],
		"risk:liquidity": [{
			sourceId: "source:cashflow",
			entityType: "risk",
			entityId: "liquidity",
			field: "exposureAmount"
		}],
		"kpi:net-worth": [{
			sourceId: "source:portfolio",
			entityType: "kpi",
			entityId: "net-worth",
			field: "calculatedValue"
		}],
		"kpi:free-cash-flow": [{
			sourceId: "source:cashflow",
			entityType: "kpi",
			entityId: "free-cash-flow",
			field: "calculatedValue"
		}],
		"kpi:savings-rate": [{
			sourceId: "source:cashflow",
			entityType: "kpi",
			entityId: "savings-rate",
			field: "calculatedValue"
		}],
		"kpi:fixed-cost-ratio": [{
			sourceId: "source:cashflow",
			entityType: "kpi",
			entityId: "fixed-cost-ratio",
			field: "calculatedValue"
		}],
		"kpi:emergency-coverage": [{
			sourceId: "source:cashflow",
			entityType: "kpi",
			entityId: "emergency-coverage",
			field: "calculatedValue"
		}],
		"kpi:debt-ratio": [{
			sourceId: "source:cashflow",
			entityType: "kpi",
			entityId: "debt-ratio",
			field: "calculatedValue"
		}]
	};
	var sourceRefCollections = [
		"incomes",
		"accounts",
		"assets",
		"liabilities",
		"budgetBuckets",
		"projects",
		"risks",
		"kpis"
	];
	function withDefaultSourceRefs(snapshot) {
		sourceRefCollections.forEach((collection) => {
			snapshot[collection].forEach((item) => {
				const refs = defaultSourceRefs[item.id];
				if (refs) item.sourceRefs = refs;
			});
		});
		return snapshot;
	}
	var personalCfoMockSnapshot = withDefaultSourceRefs({
		person: {
			id: "person:me",
			label: "나"
		},
		dataSources: [
			{
				id: "source:manual",
				label: "수동 입력",
				type: "manual",
				description: "오늘은 목업 데이터를 직접 바꾸는 단계입니다."
			},
			{
				id: "source:cashflow",
				label: "현금흐름 데이터",
				type: "financeData",
				description: "나중에 거래/카드/보험/자산 테이블에서 월 소득과 고정비를 가져옵니다."
			},
			{
				id: "source:portfolio",
				label: "포트폴리오 데이터",
				type: "portfolioData",
				description: "Supabase portfolios의 계좌, 자산, 부채 평가액을 연결합니다."
			},
			{
				id: "source:life-todos",
				label: "할일/프로젝트 데이터",
				type: "todoData",
				description: "부동산 청약과 온라인 석사 준비 프로젝트를 연결합니다."
			}
		],
		incomes: [{
			id: "income:salary",
			label: "월급",
			monthlyAmount: 42e5,
			stabilityScore: 78
		}],
		accounts: [
			{
				id: "account:portfolio:operating",
				label: "생활계좌 3개",
				balance: 1e6,
				liquidityScore: 95,
				bucketKey: "operating"
			},
			{
				id: "account:portfolio:defense",
				label: "안전자산 계좌 5개",
				balance: 101084176,
				liquidityScore: 70,
				bucketKey: "defense"
			},
			{
				id: "account:portfolio:housing",
				label: "청약통장 1개",
				balance: 1e7,
				liquidityScore: 60,
				bucketKey: "housing"
			},
			{
				id: "account:portfolio:growth",
				label: "증권계좌 현금 5개",
				balance: 4910842,
				liquidityScore: 85,
				bucketKey: "growth"
			}
		],
		assets: [
			{
				id: "asset:etf",
				label: "ETF 포트폴리오",
				marketValue: 42e6,
				bucketKey: "growth",
				volatilityScore: 52
			},
			{
				id: "asset:pension",
				label: "연금/퇴직 준비",
				marketValue: 18e6,
				bucketKey: "growth",
				volatilityScore: 30
			},
			{
				id: "asset:housing-deposit",
				label: "전월세 보증금",
				marketValue: 8e7,
				bucketKey: "housing",
				volatilityScore: 18
			}
		],
		liabilities: [{
			id: "liability:portfolio:workplace-loan",
			label: "e프리미엄 직장인론",
			outstandingBalance: 65e6,
			monthlyPayment: 0,
			interestRate: 0,
			riskScore: 73
		}],
		budgetBuckets: [
			{
				id: "operating",
				label: "운영자금",
				monthlyAllocation: 125e4,
				currentBalance: 32e5,
				fixedCostAmount: 115e4,
				targetBalance: 4e6
			},
			{
				id: "defense",
				label: "방어자금",
				monthlyAllocation: 3e5,
				currentBalance: 12e6,
				fixedCostAmount: 18e4,
				targetBalance: 15e6
			},
			{
				id: "housing",
				label: "주거자금",
				monthlyAllocation: 65e4,
				currentBalance: 34e6,
				fixedCostAmount: 42e4,
				targetBalance: 8e7
			},
			{
				id: "growth",
				label: "성장자금",
				monthlyAllocation: 5e5,
				currentBalance: 648e5,
				fixedCostAmount: 0,
				targetBalance: 15e7
			},
			{
				id: "humanCapital",
				label: "인적자본",
				monthlyAllocation: 22e4,
				currentBalance: 18e5,
				fixedCostAmount: 12e4,
				targetBalance: 6e6
			},
			{
				id: "experience",
				label: "경험자금",
				monthlyAllocation: 18e4,
				currentBalance: 24e5,
				fixedCostAmount: 0,
				targetBalance: 5e6
			}
		],
		projects: [{
			id: "project:changneung",
			label: "부동산 청약 준비",
			bucketKey: "housing",
			status: "active",
			monthlyBurn: 65e4,
			targetAmount: 8e7,
			currentAmount: 34e6,
			strategicImportance: 96,
			urgency: 82,
			expectedReturn: 68,
			riskReduction: 74
		}, {
			id: "project:online-master",
			label: "온라인 석사 준비",
			bucketKey: "humanCapital",
			status: "planned",
			monthlyBurn: 25e4,
			targetAmount: 12e6,
			currentAmount: 6e5,
			strategicImportance: 78,
			urgency: 48,
			expectedReturn: 76,
			riskReduction: 44
		}],
		risks: [
			{
				id: "risk:job-loss",
				label: "실직/소득 공백",
				level: "high",
				likelihood: 38,
				impact: 92,
				exposureAmount: 18e6,
				mitigatedByBucket: "defense"
			},
			{
				id: "risk:interest-rate",
				label: "금리 상승",
				level: "medium",
				likelihood: 45,
				impact: 70,
				exposureAmount: 35e6,
				mitigatedByBucket: "housing"
			},
			{
				id: "risk:market-drawdown",
				label: "투자자산 하락",
				level: "medium",
				likelihood: 48,
				impact: 66,
				exposureAmount: 6e7,
				mitigatedByBucket: "growth"
			},
			{
				id: "risk:health",
				label: "건강/컨디션 저하",
				level: "medium",
				likelihood: 30,
				impact: 72,
				exposureAmount: 8e6,
				mitigatedByBucket: "defense"
			},
			{
				id: "risk:liquidity",
				label: "현금 유동성 부족",
				level: "high",
				likelihood: 42,
				impact: 86,
				exposureAmount: 12e6,
				mitigatedByBucket: "operating"
			}
		],
		kpis: [
			{
				id: "kpi:net-worth",
				label: "순자산",
				currentValue: 0,
				targetValue: 25e7,
				unit: "KRW"
			},
			{
				id: "kpi:savings-rate",
				label: "저축률",
				currentValue: 0,
				targetValue: 35,
				unit: "PERCENT"
			},
			{
				id: "kpi:free-cash-flow",
				label: "월 잉여현금흐름",
				currentValue: 0,
				targetValue: 7e5,
				unit: "KRW"
			},
			{
				id: "kpi:fixed-cost-ratio",
				label: "고정비율",
				currentValue: 0,
				targetValue: 50,
				unit: "PERCENT"
			},
			{
				id: "kpi:emergency-coverage",
				label: "비상금 커버리지",
				currentValue: 0,
				targetValue: 6,
				unit: "MONTHS"
			},
			{
				id: "kpi:debt-ratio",
				label: "부채비율",
				currentValue: 0,
				targetValue: 25,
				unit: "PERCENT"
			}
		]
	});
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
		return {
			totalAssets: calculateTotalAssets(snapshot),
			totalLiabilities: calculateTotalLiabilities(snapshot),
			netWorth: calculateNetWorth(snapshot),
			monthlyFreeCashFlow: calculateMonthlyFreeCashFlow(snapshot),
			savingsRate: calculateSavingsRate(snapshot),
			fixedCostRatio: calculateFixedCostRatio(snapshot),
			debtRatio: calculateDebtRatio(snapshot),
			emergencyCoverageMonths: calculateEmergencyCoverageMonths(snapshot),
			projectBurnRate: calculateProjectBurnRate(snapshot)
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
		return {
			...snapshot,
			cashFlow,
			incomes: primaryIncome ? [{
				...primaryIncome,
				label: `${cashFlow.periodLabel} 수입`,
				monthlyAmount: cashFlow.totalIncome
			}, ...snapshot.incomes.slice(1)] : snapshot.incomes
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
		const bucketAmounts = snapshot.cashFlow?.bucketOutflows;
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
		snapshot.budgetBuckets.forEach((bucket, index) => {
			const amount = bucketAmounts ? bucketAmounts[bucket.id] : bucket.monthlyAllocation;
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
				y: bucketStartY + snapshot.budgetBuckets.length * bucketGap,
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
			y: bucketStartY + (snapshot.budgetBuckets.length + (debtRepayment > 0 ? 1 : 0)) * bucketGap,
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
	function createPersonalCfoPageModel(snapshot = personalCfoMockSnapshot, graphMode = "balanceSheet") {
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
	function PersonalCfoPage(snapshot = personalCfoMockSnapshot) {
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
	exports.PersonalCfoPage = PersonalCfoPage;
	exports.applyCashFlowData = applyCashFlowData;
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
	exports.createPersonalCfoPageModel = createPersonalCfoPageModel;
	exports.getBucketFundingProgress = getBucketFundingProgress;
	exports.personalCfoMockSnapshot = personalCfoMockSnapshot;
	exports.selectLatestClosedCashFlow = selectLatestClosedCashFlow;
	exports.summarizeCashFlowPeriod = summarizeCashFlowPeriod;
	return exports;
})({});

//# sourceMappingURL=personal-cfo-domain.js.map