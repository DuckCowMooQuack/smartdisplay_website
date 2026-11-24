import unittest
from unittest.mock import patch

import smartdisplay as display


class SceneControlTests(unittest.TestCase):
    def setUp(self):
        self.client = display.app.test_client()
        self.token = patch.object(display, 'SMARTDISPLAY_SCENE_TOKEN', 'test-scene-token')
        self.token.start()
        self.addCleanup(self.token.stop)
        with display.SCENE_LOCK:
            display.SCENE_STATE.update(scene=None, started_at=None, ends_at=None, id=None)
        self.headers = {'Authorization': 'Bearer test-scene-token'}

    def play(self, **payload):
        return self.client.post('/api/scene', json=dict(scene='christmas', **payload), headers=self.headers)

    def test_control_requires_token_but_status_and_preview_are_public(self):
        self.assertEqual(self.client.post('/api/scene', json={'scene': 'christmas'}).status_code, 401)
        self.assertEqual(self.client.get('/api/scene').status_code, 200)
        self.assertEqual(self.client.get('/scenes/christmas').status_code, 200)
        with patch.object(display, 'SMARTDISPLAY_SCENE_TOKEN', ''):
            self.assertEqual(self.play().status_code, 503)

    def test_song_duration_expiry_and_replay(self):
        with patch.object(display.time, 'time', return_value=1000):
            first = self.play().get_json()
        self.assertEqual(first['ends_at'] - first['started_at'], 241)
        with patch.object(display.time, 'time', return_value=1100):
            second = self.play(duration=10).get_json()
        self.assertNotEqual(first['id'], second['id'])
        self.assertEqual(second['ends_at'], 1110)
        with patch.object(display.time, 'time', return_value=1110):
            self.assertIsNone(self.client.get('/api/scene').get_json()['scene'])

    def test_invalid_requests_do_not_interrupt_scene(self):
        first = self.play().get_json()
        for duration in [0, -1, 3601, True, '241', None, float('nan'), float('inf')]:
            self.assertEqual(self.play(duration=duration).status_code, 400)
        for payload in [[], None, {'scene': 'unknown'}]:
            self.assertEqual(self.client.post('/api/scene', json=payload, headers=self.headers).status_code, 400)
        self.assertEqual(self.client.get('/api/scene').get_json()['id'], first['id'])

    def test_stop_and_uncached_status(self):
        self.play()
        response = self.client.post('/api/scene', json={'scene': 'off'}, headers=self.headers)
        self.assertIsNone(response.get_json()['scene'])
        self.assertEqual(self.client.get('/api/scene').headers['Cache-Control'], 'no-store')


if __name__ == '__main__':
    unittest.main()
