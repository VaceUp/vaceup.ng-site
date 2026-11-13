from unittest.mock import patch
from django.test import SimpleTestCase, override_settings
from apps.challenges import engagement


class EngagementTests(SimpleTestCase):
    def test_two_column_header_and_key_value_exports_are_both_supported(self):
        for rows in ([["likes", "comments"], ["10", "5"]], [["likes", "10"], ["comments", "5"]]):
            result = engagement.extract_counter_rows(rows)
            self.assertEqual(result["counts"]["likes"], 10)
            self.assertEqual(result["counts"]["comments"], 5)
            self.assertEqual(result["flags"], [])

    def test_canonical_post_dedupes_variants_but_not_unknown_urns(self):
        a = engagement.canonicalize_post_url("https://www.linkedin.com/posts/test_activity-123456789-abcd?utm_source=test")
        b = engagement.canonicalize_post_url("https://linkedin.com/feed/update/urn%3Ali%3Aactivity%3A123456789/")
        c = engagement.canonicalize_post_url("https://linkedin.com/feed/update/urn:li:share:123456789/")
        self.assertEqual(a, b)
        self.assertNotEqual(a[1], c[1])
        self.assertEqual(engagement.canonicalize_post_url("https://instagram.com/reel/Example123/?igsh=tracking")[1], "instagram:Example123")

    def test_arbitrary_url_credentials_ports_and_platform_mismatch_rejected(self):
        for url in ("http://instagram.com/p/Example123/", "https://user:password@instagram.com/p/Example123/", "https://127.0.0.1/p/Example123/", "https://instagram.com:8443/p/Example123/", "https://www.linkedin.com/in/person/"):
            with self.assertRaises(ValueError):
                engagement.canonicalize_post_url(url)
        with self.assertRaises(ValueError):
            engagement.canonicalize_post_url("https://instagram.com/p/Example123/", "linkedin")

    def test_missing_counts_stay_null_zero_is_real_and_bad_counts_rejected(self):
        self.assertIsNone(engagement.parse_count("hidden"))
        self.assertEqual(engagement.parse_count("0"), 0)
        self.assertEqual(engagement.parse_count("1,234"), 1234)
        for value in (-1, True, "1,23", "1.5", "NaN", "12%", 10 ** 13):
            with self.assertRaises(ValueError):
                engagement.parse_count(value)

    def test_counter_rows_rounding_conflicts_and_followers_are_not_silently_scored(self):
        result = engagement.extract_counter_rows([["likes", "comments", "followers"], ["1.2K", "5", "10000"]])
        self.assertEqual(result["counts"]["likes"], 1200)
        self.assertIn("rounded_likes_counter", result["flags"])
        self.assertIsNone(result["counts"]["views"])
        conflicting = engagement.extract_counter_rows([["likes", "10"], ["likes", "20"]])
        self.assertIsNone(conflicting["counts"]["likes"])
        self.assertIn("conflicting_likes_counters", conflicting["flags"])

    def test_fixed_twelve_eight_caps_and_null_denominator_policy(self):
        self.assertEqual(engagement.engagement_points(0, 0, 100, 20), 0)
        self.assertEqual(engagement.engagement_points(100, 20, 100, 20), 20)
        self.assertEqual(engagement.engagement_points(10000, 20000, 100, 20), 20)
        self.assertIsNone(engagement.engagement_points(100, None, 100, 20))
        with self.assertRaises(ValueError):
            engagement.engagement_points(10, 10, None, 20)

    def test_decreases_retained_instead_of_lifetime_maximum(self):
        self.assertLess(engagement.engagement_points(5, 2, 100, 20), engagement.engagement_points(50, 10, 100, 20))

    def test_declaration_discrepancies_flagged_without_source_relabelling(self):
        flags = engagement.reconcile_counts({"likes": 99}, {"likes": 10})
        self.assertIn("declared_likes_disagrees_with_evidence", flags)

    def test_public_parser_requires_matching_post_identity(self):
        html = '<script type="application/ld+json">{"url":"https://www.instagram.com/p/Example123/","interactionStatistic":[{"interactionType":"https://schema.org/LikeAction","userInteractionCount":20}]}</script>'
        self.assertEqual(engagement.parse_public_post_html(html, "https://instagram.com/p/Example123/")["counts"]["likes"], 20)
        self.assertIsNone(engagement.parse_public_post_html(html, "https://instagram.com/p/Other123/")["counts"]["likes"])

    @override_settings(CHALLENGE_PUBLIC_COUNTER_COLLECTOR="disabled")
    def test_disabled_public_collector_performs_no_network_request(self):
        with patch("apps.challenges.engagement._read_public_page") as fetch:
            result = engagement.collect_public_observation("https://instagram.com/p/Example123/")
        fetch.assert_not_called()
        self.assertEqual(result["status"], "unavailable")
        self.assertEqual(result["source"], "publicly_observed")
        self.assertIsNone(result["counts"]["likes"])

    @override_settings(CHALLENGE_PUBLIC_COUNTER_COLLECTOR="permitted_public_html")
    def test_public_collector_blocks_private_dns_before_connecting(self):
        with patch("apps.challenges.engagement.socket.getaddrinfo", return_value=[(2, 1, 6, "", ("127.0.0.1", 443))]), patch("apps.challenges.engagement.socket.create_connection") as connect:
            result = engagement.collect_public_observation("https://instagram.com/p/Example123/")
        connect.assert_not_called()
        self.assertEqual(result["status"], "unavailable")
