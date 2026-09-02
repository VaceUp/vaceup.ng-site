from django.http import HttpResponse
from django.views import View


class HealthView(View):
    def get(self, request):
        return HttpResponse("OK")


class SitemapView(View):
    def get(self, request):
        from django.urls import reverse
        from django.contrib.sitemaps import Sitemap
        from django.contrib.sitemaps.views import sitemap
        from django.apps import apps
        from django.urls import get_resolver
        from django.urls.resolvers import URLPattern, URLResolver
        from django.conf import settings

        class StaticViewSitemap(Sitemap):
            priority = 1.0
            changefreq = 'daily'

            def items(self):
                return [
                    'home',
                    'courses:list',
                    'courses:detail',
                    'accounts:login',
                    'accounts:register',
                    'accounts:verify-email',
                    'accounts:password-reset',
                    'accounts:password-reset-confirm',
                    'liveclasses:list',
                    'liveclasses:detail',
                    'assignments:list',
                    'assignments:detail',
                    'certificates:list',
                    'certificates:detail',
                    'applications:list',
                    'applications:detail',
                    'payments:checkout',
                    'payments:verify',
                    'liveclasses:list',
                    'liveclasses:detail',
                    'certificates:list',
                    'certificates:verify',
                    'applications:list',
                    'applications:detail',
                    'announcements:list',
                    'announcements:detail',
                    'messaging:list',
                    'messaging:thread',
                    'payments:checkout',
                    'payments:verify',
                    'cart:list',
                    'cart:checkout',
                    'dashboard:stats',
                    'announcements:list',
                    'announcements:detail',
                    'codeeditor:page',
                    'whiteboard:page',
                    'marketing:page',
                ]

            def location(self, item):
                try:
                    return reverse(item)
                except Exception:
                    return '/'

        class CourseSitemap(Sitemap):
            changefreq = 'weekly'
            priority = 0.8

            def items(self):
                from apps.courses.models import Course
                return Course.objects.filter(is_published=True).select_related('category', 'instructor')

            def lastmod(self, obj):
                return obj.updated_at

            def location(self, obj):
                from django.urls import reverse
                return reverse('courses:detail', kwargs={'slug': obj.slug})

        class LiveClassSitemap(Sitemap):
            changefreq = 'daily'
            priority = 0.8

            def items(self):
                from apps.liveclasses.models import LiveClass
                from django.utils import timezone
                return LiveClass.objects.filter(
                    status__in=['scheduled', 'live'],
                    scheduled_start__gte=timezone.now()
                ).select_related('course', 'instructor')

            def lastmod(self, obj):
                return obj.updated_at

            def location(self, obj):
                from django.urls import reverse
                return reverse('liveclasses:detail', kwargs={'pk': obj.pk})

        class AnnouncementSitemap(Sitemap):
            changefreq = 'weekly'
            priority = 0.7

            def items(self):
                from apps.announcements.models import Announcement
                from django.utils import timezone
                return Announcement.objects.filter(
                    status='published',
                    publish_at__lte=timezone.now()
                ).filter(
                    models.Q(expires_at__isnull=True) | models.Q(expires_at__gte=timezone.now())
                )

            def lastmod(self, obj):
                return obj.updated_at

            def location(self, obj):
                from django.urls import reverse
                return reverse('announcements:detail', kwargs={'pk': obj.pk})

        class StaticViewSitemap(Sitemap):
            priority = 1.0
            changefreq = 'daily'

            def items(self):
                return [
                    'home',
                    'courses:list',
                    'accounts:login',
                    'accounts:register',
                    'accounts:verify-email',
                    'accounts:password-reset',
                    'accounts:password-reset-confirm',
                ]

            def location(self, item):
                from django.urls import reverse
                try:
                    return reverse(item)
                except Exception:
                    return '/'

        from django.utils import timezone
        from django.db import models

        sitemaps = {
            'static': StaticViewSitemap,
            'courses': CourseSitemap,
            'liveclasses': LiveClassSitemap,
            'announcements': AnnouncementSitemap,
        }

        return sitemap(request, sitemaps)


class RobotsTxtView(View):
    def get(self, request):
        lines = [
            "User-agent: *",
            "Allow: /",
            "Disallow: /api/",
            "Disallow: /admin/",
            "Disallow: /api/v1/",
            "Disallow: /dashboard/",
            "Disallow: /dashboard/*",
            "Disallow: /live-classes/*/join/",
            "Disallow: /dashboard/",
            "Disallow: /accounts/",
            "Disallow: /cart/",
            "Disallow: /checkout/",
            "Disallow: /payments/",
            "Disallow: /api/v1/",
            "",
            "Sitemap: https://vaceup.ng/sitemap.xml",
        ]
        return HttpResponse("\n".join(lines), content_type="text/plain")


healthz = HealthView.as_view()
sitemap_xml = SitemapView.as_view()
robots_txt = RobotsTxtView.as_view()