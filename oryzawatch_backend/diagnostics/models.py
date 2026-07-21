# pyrefly: ignore [missing-import]
from django.db import models
# pyrefly: ignore [missing-import]
from django.conf import settings

class LeafScan(models.Model):
    DISEASE_CHOICES = (
        ('HEALTHY', 'Healthy'),
        ('BLB', 'Bacterial Leaf Blight'),
        ('BLAST', 'Rice Blast'),
        ('BROWN_SPOT', 'Brown Spot'),
    )
    
    # Links the report back to the User (Farmer/Kagawad) who took it
    reporter = models.ForeignKey(
        settings.AUTH_USER_MODEL, 
        on_delete=models.CASCADE, 
        related_name='leaf_scans'
    )
    # Stores the physical image file inside a folder called /media/leaf_scans/
    image = models.ImageField(upload_to='leaf_scans/')
    
    # AI Classification Results
    detected_disease = models.CharField(max_length=20, choices=DISEASE_CHOICES, default='HEALTHY')
    confidence_score = models.FloatField(default=0.0)  # e.g., 0.8567 for 85.67%
    
    # Geospatial Coordinates (Vital for Leaflet.js Mapping)
    latitude = models.DecimalField(max_digits=9, decimal_places=6)
    longitude = models.DecimalField(max_digits=9, decimal_places=6)
    
    created_at = models.DateTimeField(auto_now_add=True)

    def __str__(self):
        return f"{self.detected_disease} ({self.confidence_score * 100:.1f}%) - {self.created_at.strftime('%Y-%m-%d %H:%M')}"