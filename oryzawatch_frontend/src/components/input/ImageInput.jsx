import React, { useState, useRef } from 'react';

const ImageInput = ({ label, onImageSelect, required = true }) => {
    const [preview, setPreview] = useState(null);
    const fileInputRef = useRef(null);

    const handleFileChange = (e) => {
        const file = e.target.files[0];
        if (file) {
            // Generate a local temporary URL to display a preview thumbnail
            setPreview(URL.createObjectURL(file));
            
            // Send the physical file object back up to the parent form component
            if (onImageSelect) {
                onImageSelect(file);
            }
        }
    };

    const triggerFileSelect = () => {
        fileInputRef.current.click();
    };

    const handleClear = (e) => {
        e.stopPropagation(); // Avoid triggering file selection when clearing
        setPreview(null);
        fileInputRef.current.value = '';
        if (onImageSelect) {
            onImageSelect(null);
        }
    };

    return (
        <div style={styles.group}>
            <label style={styles.label}>{label}</label>
            
            {/* Hidden native input element */}
            <input
                type="file"
                accept="image/*"
                ref={fileInputRef}
                onChange={handleFileChange}
                required={required && !preview}
                style={{ display: 'none' }}
            />

            {/* Clickable Custom Upload Box Area */}
            <div onClick={triggerFileSelect} style={styles.uploadArea}>
                {!preview ? (
                    <div style={styles.placeholderBox}>
                        <span style={styles.icon}>📷</span>
                        <span style={styles.text}>Click to select leaf image</span>
                        <span style={styles.subtext}>Supports PNG, JPG, or JPEG</span>
                    </div>
                ) : (
                    <div style={styles.previewContainer}>
                        <img src={preview} alt="Leaf preview" style={styles.imagePreview} />
                        <button type="button" onClick={handleClear} style={styles.clearBtn}>
                            Remove Image
                        </button>
                    </div>
                )}
            </div>
        </div>
    );
};

const styles = {
    group: { display: 'flex', flexDirection: 'column', textAlign: 'left', gap: '6px', marginBottom: '16px' },
    label: { fontSize: '13px', color: '#ccc', fontWeight: '500' },
    uploadArea: { border: '2px dashed #444', borderRadius: '8px', padding: '20px', textAlign: 'center', backgroundColor: '#1a1a1a', cursor: 'pointer', position: 'relative', minHeight: '150px', display: 'flex', justifyContent: 'center', alignItems: 'center', transition: 'border-color 0.2s' },
    placeholderBox: { display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '4px' },
    icon: { fontSize: '32px' },
    text: { color: '#fff', fontSize: '14px', fontWeight: 'bold' },
    subtext: { color: '#666', fontSize: '11px' },
    previewContainer: { position: 'relative', width: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '10px' },
    imagePreview: { maxWidth: '100%', maxHeight: '180px', borderRadius: '6px', objectFit: 'contain' },
    clearBtn: { padding: '6px 12px', backgroundColor: '#d32f2f', color: '#fff', border: 'none', borderRadius: '4px', fontSize: '12px', cursor: 'pointer', fontWeight: 'bold' }
};

export default ImageInput;