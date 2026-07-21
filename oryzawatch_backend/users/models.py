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