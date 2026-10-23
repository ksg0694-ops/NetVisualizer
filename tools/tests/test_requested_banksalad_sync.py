from __future__ import annotations
import sys
import unittest
from pathlib import Path
from unittest.mock import Mock, patch
sys.path.insert(0, str(Path(__file__).resolve().parents[1]))
from run_requested_banksalad_sync import run_request
from banksalad_mail_sync import run_gmail_sync, parse_args, SyncError

REQUEST = '11111111-1111-4111-8111-111111111111'

class RequestedSyncTests(unittest.TestCase):
    def database(self, claimed=True):
        db = Mock(owner_user_id='test-owner')
        db._request.return_value.json.side_effect = [[{'id': REQUEST}] if claimed else [], []]
        return db

    def test_success_and_noop_are_acknowledged(self):
        for count in [0, 12]:
            db = self.database()
            def importer(args, totals):
                self.assertFalse(args.dry_run)
                totals.update(messages_processed=1 if count else 0, rows_inserted=count)
                return 0
            self.assertEqual(run_request(db, REQUEST, importer), 0)
            last = db._request.call_args.kwargs
            self.assertEqual(last['json']['status'], 'completed')
            self.assertEqual(last['json']['rows_inserted'], count)
            self.assertEqual(last['params']['user_id'], 'eq.test-owner')

    def test_unclaimed_request_cannot_import(self):
        importer = Mock()
        self.assertEqual(run_request(self.database(False), REQUEST, importer), 0)
        importer.assert_not_called()

    def test_partial_and_exception_acknowledge_failure_without_private_errors(self):
        for importer in [Mock(return_value=1), Mock(side_effect=ValueError('private mail data'))]:
            db = self.database()
            self.assertEqual(run_request(db, REQUEST, importer), 1)
            payload = db._request.call_args.kwargs['json']
            self.assertEqual(payload['status'], 'failed')
            self.assertNotIn('private mail', str(payload))

    def test_invalid_id_never_queries_db(self):
        db = self.database()
        for request in ['', REQUEST + ',status.eq.completed']:
            with self.assertRaises((ValueError, SyncError)):
                run_request(db, request)
        db._request.assert_not_called()

    def test_workflow_failure_never_overwrites_completed_request(self):
        db = self.database()
        self.assertEqual(run_request(db, REQUEST, Mock(), fail=True), 0)
        self.assertEqual(db._request.call_args.kwargs['params']['status'], 'in.(queued,processing)')

    @patch('banksalad_mail_sync.require_env', return_value='test')
    @patch('banksalad_mail_sync.build_gmail_service')
    @patch('banksalad_mail_sync.build_database_from_env')
    @patch('banksalad_mail_sync.list_matching_message_ids', return_value=[])
    def test_no_mail_totals(self, *_):
        totals = {}
        self.assertEqual(run_gmail_sync(parse_args([]), totals), 0)
        self.assertEqual(totals, dict(messages_processed=0, messages_failed=0, rows_inserted=0))

if __name__ == '__main__':
    unittest.main()
