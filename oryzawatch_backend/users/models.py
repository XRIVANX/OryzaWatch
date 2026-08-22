from django.contrib.auth.models import AbstractUser
from django.db import models


class User(AbstractUser):
    ROLE_CHOICES = (
        ('FARMER', 'Farmer'),
        ('KAGAWAD', 'SK / Agri-Kagawad'),
        ('MAO_ADMIN', 'Municipal Agriculture Office Admin'),
    )
    MUNICIPALITY_CHOICES = (
        ('ASUNCION', 'Asuncion'),
        ('CARMEN', 'Carmen'),
    )

    role = models.CharField(max_length=15, choices=ROLE_CHOICES, default='FARMER')
    municipality = models.CharField(max_length=15, choices=MUNICIPALITY_CHOICES)
    barangay = models.CharField(max_length=100)  # e.g., Ising, Binungan, Mangalcal
    phone_number = models.CharField(max_length=15, blank=True, null=True)

    def __str__(self):
        return f"{self.username} ({self.get_role_display()})"


class ActivityLog(models.Model):
    """Immutable audit trail for key system events."""

    ACTION_CHOICES = (
        ('LOGIN_SUCCESS',   'Login Success'),
        ('LOGIN_FAILED',    'Login Failed'),
        ('LOGIN_LOCKED',    'Account Locked'),
        ('LOGOUT',          'Logout'),
        ('REGISTER_FARMER', 'Registered Farmer'),
        ('REGISTER_KAGAWAD','Registered Kagawad'),
        ('SCAN_UPLOAD',     'AI Scan Uploaded'),
        ('ALERT_READ',      'Alert Marked Read'),
    )

    timestamp   = models.DateTimeField(auto_now_add=True, db_index=True)
    user        = models.ForeignKey(
        User,
        null=True, blank=True,
        on_delete=models.SET_NULL,
        related_name='activity_logs',
        help_text='The user who performed or triggered the action.',
    )
    action_type = models.CharField(max_length=30, choices=ACTION_CHOICES)
    details     = models.TextField(blank=True, default='')

    class Meta:
        ordering = ['-timestamp']

    def __str__(self):
        actor = self.user.username if self.user else 'system'
        return f"[{self.timestamp:%Y-%m-%d %H:%M:%S}] {actor} — {self.action_type}"