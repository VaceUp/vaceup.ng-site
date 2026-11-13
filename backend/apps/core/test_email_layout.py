"""Email design preserves structure and remains safe when authors paste markup."""
from django.core import mail
from django.test import SimpleTestCase
from apps.core.email_layout import format_email_text, render_email, safe_link


class EmailLayoutTests(SimpleTestCase):
    def test_paragraphs_headings_lists_and_inline_formatting(self):
        html = format_email_text("Hi Ada,\r\n\r\n# Before the class\nBring **Excel**.\n\n- Open the workbook\n- Check audio\n\n1. Join early\n2. Ask questions")
        self.assertIn('<h2 ', html)
        self.assertIn('<strong>Excel</strong>', html)
        self.assertIn('<ul ', html)
        self.assertIn('<ol ', html)
        self.assertEqual(html.count('<li '), 4)
        self.assertIn('margin:0 0 20px', html)
        self.assertNotIn('\r', html)

    def test_script_and_html_are_escaped_links_are_clickable(self):
        html = format_email_text('<script>alert(1)</script>\n\n<a href="javascript:alert(1)">bad</a>\n\nVisit https://vaceup.ng/events/?a=1&b=2')
        self.assertNotIn('<script>', html)
        self.assertNotIn('href="javascript:', html)
        self.assertIn('&lt;script&gt;', html)
        self.assertNotIn('&amp;lt;script', html)
        self.assertIn('href="https://vaceup.ng/events/?a=1&amp;b=2"', html)

    def test_subject_and_details_escape_and_invalid_cta_is_omitted(self):
        html = render_email(title='<img src=x onerror=bad>', text='Hello', details=[('When', '<script>bad</script>')], cta_label='Unsafe', cta_url='javascript:alert(1)')
        self.assertNotIn('<img src=x', html)
        self.assertNotIn('<script>', html)
        self.assertNotIn('javascript:', html)
        self.assertIn('&lt;img', html)
        self.assertIn('role="presentation"', html)
        self.assertIn('max-width:600px', html)
        self.assertIn('name="viewport"', html)

    def test_footer_unsubscribe_occurs_once_and_no_tracking_pixel(self):
        html = render_email(title='News', text='Your class begins soon.', unsubscribe_url='https://api.example/unsubscribe/secret/')
        self.assertEqual(html.count('https://api.example/unsubscribe/secret/'), 1)
        self.assertNotIn('<img', html)
        self.assertEqual(safe_link('https://user:password@example.com/'), '')
        self.assertEqual(safe_link('data:text/html,bad'), '')
