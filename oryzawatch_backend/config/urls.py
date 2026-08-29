from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from users.views import register_user, login_user, get_user_profile, admin_exists, activity_log_list, initial_setup, list_users
from diagnostics.views import LeafScanCreateView, LeafScanListView 
# Import your new analytics views here!
from analytics.views import ActiveHotspotListView, HotspotDetailView, DashboardStatsView
from rest_framework_simplejwt.views import TokenRefreshView
from alerts.views import AlertListView, AlertMarkReadView


urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth Endpoints
    path('api/auth/register/', register_user, name='auth_register'),
    path('api/auth/login/', login_user, name='auth_login'),
    path('api/auth/profile/', get_user_profile, name='user_profile'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    path('api/auth/admin-exists/', admin_exists, name='admin_exists'),
    path('api/auth/setup/', initial_setup, name='initial_setup'),
    path('api/auth/logs/', activity_log_list, name='activity_logs'),
    
    # Users List Endpoint (Farmers / Kagawads / Admins)
    path('api/users/', list_users, name='user_list'),
    
    # Core Diagnostics Scan Endpoints
    path('api/diagnostics/upload/', LeafScanCreateView.as_view(), name='upload_scan'),
    path('api/diagnostics/history/', LeafScanListView.as_view(), name='scan_history'),
    
    # Core Spatiotemporal Analytics Endpoints!
    path('api/analytics/hotspots/', ActiveHotspotListView.as_view(), name='active_hotspots'),
    path('api/analytics/hotspots/<int:pk>/', HotspotDetailView.as_view(), name='hotspot_detail'),
    path('api/dashboard/stats/', DashboardStatsView.as_view(), name='dashboard_stats'),
    
    # Alert Endpoints
    path('api/alerts/', AlertListView.as_view(), name='alert_list'),
    path('api/alerts/<int:pk>/mark-read/', AlertMarkReadView.as_view(), name='alert_mark_read'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Serve uploaded media on the plain-HTTP exam server even with DEBUG off.
    # (Django's own static server; fine for the CTF host, not for real prod.)
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]
