import { useState } from 'react';
import API from '../../services/api';
import ImageInput from '../input/ImageInput';
import TextInput from '../input/TextInput';

const DiagnosticUpload = ({ onUploadSuccess }) => {
    const [selectedImage, setSelectedImage] = useState(null);
    // Automatically mock Tagum City tracking coordinates to keep things ready
    const [coords, setCoords] = useState({ latitude: '7.4483', longitude: '125.8094' });
    const [loading, setLoading] = useState(false);
    const [message, setMessage] = useState(null);

    const handleCoordsChange = (e) => {
        setCoords({ ...coords, [e.target.name]: e.target.value });
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        if (!selectedImage) {
            alert('Please select a leaf profile picture first.');
            return;
        }

        setLoading(true);
        setMessage(null);

        // Convert the form payload into multipart/form-data format for files
        const formData = new FormData();
        formData.append('image', selectedImage);
        formData.append('latitude', coords.latitude);
        formData.append('longitude', coords.longitude);

        try {
            const response = await API.post('diagnostics/upload/', formData, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            setMessage({
                type: 'success',
                text: `Scan Complete! Condition detected: ${response.data.detected_disease} (Confidence: ${(response.data.confidence_score * 100).toFixed(1)}%)`
            });

            if (onUploadSuccess) {
                onUploadSuccess();
            }
        } catch (err) {
            console.error(err);
            setMessage({
                type: 'error',
                text: err.response?.data?.detail || 'Upload submission execution failed.'
            });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div style={styles.card}>
            <h3 style={styles.title}>📸 AI Leaf Diagnostics Engine</h3>
            <p style={styles.subtitle}>Upload rice crop specimens for instant health processing</p>

            {message && (
                <div style={{ ...styles.alert, backgroundColor: message.type === 'success' ? '#1b5e20' : '#b71c1c' }}>
                    {message.text}
                </div>
            )}

            <form onSubmit={handleSubmit}>
                <ImageInput 
                    label="Crop Leaf Image" 
                    onImageSelect={(file) => setSelectedImage(file)} 
                />

                <div style={styles.row}>
                    <TextInput 
                        label="Latitude Coordinate" 
                        name="latitude" 
                        value={coords.latitude} 
                        onChange={handleCoordsChange} 
                    />
                    <TextInput 
                        label="Longitude Coordinate" 
                        name="longitude" 
                        value={coords.longitude} 
                        onChange={handleCoordsChange} 
                    />
                </div>

                <button type="submit" disabled={loading} style={styles.submitBtn}>
                    {loading ? 'Processing ML Diagnostics...' : 'Submit Diagnostic Request'}
                </button>
            </form>
        </div>
    );
};

const styles = {
    card: { background: '#1a1a1a', padding: '24px', borderRadius: '8px', border: '1px solid #2d2d2d', maxWidth: '500px', margin: '0 auto' },
    title: { margin: '0 0 4px 0', color: '#4caf50' },
    subtitle: { fontSize: '13px', color: '#888', margin: '0 0 20px 0' },
    row: { display: 'flex', gap: '16px' },
    submitBtn: { width: '100%', padding: '12px', borderRadius: '6px', border: 'none', backgroundColor: '#4caf50', color: '#fff', fontWeight: 'bold', cursor: 'pointer', fontSize: '15px' },
    alert: { padding: '12px', borderRadius: '6px', color: '#fff', fontSize: '14px', marginBottom: '16px', fontWeight: '500' }
};

export default DiagnosticUpload;