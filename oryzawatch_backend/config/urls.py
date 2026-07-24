from django.contrib import admin
from django.urls import path, re_path
from django.conf import settings
from django.conf.urls.static import static
from django.views.static import serve
from users.views import register_user, login_user, get_user_profile
from diagnostics.views import LeafScanCreateView, LeafScanListView 
# Import your new analytics views here!
from analytics.views import ActiveHotspotListView, HotspotDetailView
from rest_framework_simplejwt.views import TokenRefreshView

urlpatterns = [
    path('admin/', admin.site.urls),
    
    # Auth Endpoints
    path('api/auth/register/', register_user, name='auth_register'),
    path('api/auth/login/', login_user, name='auth_login'),
    path('api/auth/profile/', get_user_profile, name='user_profile'),
    path('api/auth/token/refresh/', TokenRefreshView.as_view(), name='token_refresh'),
    
    # Core Diagnostics Scan Endpoints
    path('api/diagnostics/upload/', LeafScanCreateView.as_view(), name='upload_scan'),
    path('api/diagnostics/history/', LeafScanListView.as_view(), name='scan_history'),
    
    # Core Spatiotemporal Analytics Endpoints!
    path('api/analytics/hotspots/', ActiveHotspotListView.as_view(), name='active_hotspots'),
    path('api/analytics/hotspots/<int:pk>/', HotspotDetailView.as_view(), name='hotspot_detail'),
]

if settings.DEBUG:
    urlpatterns += static(settings.MEDIA_URL, document_root=settings.MEDIA_ROOT)
else:
    # Serve uploaded media on the plain-HTTP exam server even with DEBUG off.
    # (Django's own static server; fine for the CTF host, not for real prod.)
    urlpatterns += [
        re_path(r'^media/(?P<path>.*)$', serve, {'document_root': settings.MEDIA_ROOT}),
    ]