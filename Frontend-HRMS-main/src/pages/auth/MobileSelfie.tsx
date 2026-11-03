import { useEffect, useRef, useState } from 'react'
import { useParams, useSearchParams } from 'react-router-dom'
import { attendanceApi } from '../../api/attendance.api'
import { detectFaceInVideo, drawFaceDetectorOverlay, FaceDetectionResult } from '../../utils/faceDetector'

type Stage = 'loading' | 'camera' | 'preview' | 'uploading' | 'success' | 'error' | 'expired' | 'already'

export default function MobileSelfie() {
  const { sessionId } = useParams<{ sessionId: string }>()
  const [searchParams] = useSearchParams()
  const token = searchParams.get('token') ?? ''

  const [stage, setStage] = useState<Stage>('loading')
  const [errorMsg, setErrorMsg] = useState('')
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState(0)
  const [countdown, setCountdown] = useState(120)
  const [stream, setStream] = useState<MediaStream | null>(null)

  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const faceOverlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null)
  const animLoopRef = useRef<number | null>(null)

  // ── Verify session on mount ───────────────────────────────────────────────
  useEffect(() => {
    if (!sessionId || !token) {
      setErrorMsg('Invalid link. Please scan the QR code again.')
      setStage('error')
      return
    }
    checkSession()
  }, [])

  const checkSession = async () => {
    try {
      const res = await attendanceApi.getMobileQrStatus(sessionId!)
      const { status } = res.data.data
      if (status === 'VERIFIED') { setStage('already'); return }
      if (status === 'FAILED') { setErrorMsg('This session has failed. Ask your HR to reset.'); setStage('error'); return }
      if (status === 'EXPIRED') { setStage('expired'); return }
      // PENDING — proceed to camera
      startCamera()
    } catch {
      setErrorMsg('Could not reach the server. Please try again.')
      setStage('error')
    }
  }

  // ── Camera ────────────────────────────────────────────────────────────────
  const startFaceDetectionLoop = () => {
    if (animLoopRef.current) cancelAnimationFrame(animLoopRef.current);
    let isBusy = false;
    const loop = async () => {
      const video = videoRef.current;
      const canvas = faceOverlayCanvasRef.current;
      if (video && canvas && video.readyState >= 2 && !video.paused && !video.ended) {
        if (canvas.width !== (video.videoWidth || 640) || canvas.height !== (video.videoHeight || 480)) {
          canvas.width = video.videoWidth || 640;
          canvas.height = video.videoHeight || 480;
        }
        if (!isBusy) {
          isBusy = true;
          try {
            const res = await detectFaceInVideo(video);
            setFaceResult(res);
            drawFaceDetectorOverlay(canvas, video, res);
          } catch (e) {
            console.error(e);
          } finally {
            isBusy = false;
          }
        }
      }
      animLoopRef.current = requestAnimationFrame(loop);
    };
    animLoopRef.current = requestAnimationFrame(loop);
  };

  const startCamera = async () => {
    setStage('camera');
    try {
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'user', width: { ideal: 640 }, height: { ideal: 480 } },
      });
      setStream(mediaStream);
      if (videoRef.current) {
        videoRef.current.srcObject = mediaStream;
        await videoRef.current.play();
        startFaceDetectionLoop();
      }
    } catch {
      setErrorMsg('Camera permission denied. Please allow camera access and refresh.');
      setStage('error');
    }
  };

  const stopCamera = () => {
    if (animLoopRef.current) {
      cancelAnimationFrame(animLoopRef.current);
      animLoopRef.current = null;
    }
    stream?.getTracks().forEach(t => t.stop());
    setStream(null);
    setFaceResult(null);
  };

  // ── Countdown ─────────────────────────────────────────────────────────────
  useEffect(() => {
    if (stage !== 'camera' && stage !== 'preview') return
    if (countdown <= 0) { setStage('expired'); stopCamera(); return }
    const t = setTimeout(() => setCountdown(c => c - 1), 1000)
    return () => clearTimeout(t)
  }, [stage, countdown])

  // ── Capture selfie ────────────────────────────────────────────────────────
  const capture = () => {
    if (!faceResult?.detected) {
      alert('⚠️ Human face must be clearly visible inside the outline before capturing. Please look directly at the camera.');
      return;
    }
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas) return

    canvas.width = video.videoWidth || 480
    canvas.height = video.videoHeight || 360
    const ctx = canvas.getContext('2d')
    if (!ctx) return
    // Mirror the canvas to match front camera natural orientation
    ctx.translate(canvas.width, 0)
    ctx.scale(-1, 1)
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL('image/jpeg', 0.85)
    setCapturedImage(dataUrl)
    stopCamera()
    setStage('preview')
  }

  const retake = () => {
    setCapturedImage(null)
    startCamera()
  }

  // ── Upload selfie ─────────────────────────────────────────────────────────
  const uploadSelfie = async () => {
    if (!capturedImage || !sessionId || !token) return
    setStage('uploading')
    setUploadProgress(0)

    // Animate progress bar
    const progInterval = setInterval(() => {
      setUploadProgress(p => (p < 85 ? p + 5 : p))
    }, 200)

    try {
      await attendanceApi.verifyMobileSelfie({
        sessionId,
        token,
        selfieBase64: capturedImage,
      })
      clearInterval(progInterval)
      setUploadProgress(100)
      setStage('success')
    } catch (err: any) {
      clearInterval(progInterval)
      const msg = err.response?.data?.message || 'Verification failed. Please retake.'
      setErrorMsg(msg)
      setStage('error')
    }
  }

  const fmtTime = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`

  // ─────────────────────────────────────────────────────────────────────────
  return (
    <div style={styles.root}>
      <div style={styles.card}>

        {/* Header */}
        <div style={styles.header}>
          <div style={styles.logo}>HRMS</div>
          <h1 style={styles.title}>Mobile Attendance</h1>
          <p style={styles.subtitle}>QR Selfie Verification</p>
        </div>

        {/* ── LOADING ── */}
        {stage === 'loading' && (
          <div style={styles.centerBox}>
            <div style={styles.spinner} />
            <p style={styles.hint}>Validating session…</p>
          </div>
        )}

        {/* ── CAMERA ── */}
        {stage === 'camera' && (
          <div style={styles.cameraSection}>
            <div style={styles.timerBadge}>
              ⏱ {fmtTime(countdown)}
            </div>
            <p style={styles.hint}>Position your face inside the oval and tap Capture</p>

            <div style={{ ...styles.videoWrapper, position: 'relative' }}>
              <video
                ref={videoRef}
                playsInline
                muted
                style={styles.video}
              />
              <canvas
                ref={faceOverlayCanvasRef}
                style={{
                  position: 'absolute',
                  top: 0,
                  left: 0,
                  width: '100%',
                  height: '100%',
                  pointerEvents: 'none',
                  zIndex: 10
                }}
              />
              {/* Scan line animation */}
              <div style={styles.scanLine} />
            </div>

            {/* Live Face Detection Status */}
            <div
              style={{
                marginTop: '10px',
                padding: '6px 12px',
                borderRadius: '8px',
                fontSize: '0.75rem',
                fontWeight: 600,
                textAlign: 'center',
                background: faceResult?.detected ? '#ecfdf5' : '#fef2f2',
                color: faceResult?.detected ? '#065f46' : '#991b1b',
                border: faceResult?.detected ? '1px solid #a7f3d0' : '1px solid #fecaca'
              }}
            >
              {faceResult?.detected
                ? `🟢 Face Detected (Green Box Active) — Ready to Capture`
                : `🔴 Face Not Visible (Red Box) — Green Box only allowed to Clock In`}
            </div>

            <canvas ref={canvasRef} style={{ display: 'none' }} />

            <button 
              onClick={capture} 
              disabled={!faceResult?.detected}
              style={{
                ...styles.captureBtn,
                opacity: faceResult?.detected ? 1 : 0.6,
                cursor: faceResult?.detected ? 'pointer' : 'not-allowed',
                filter: faceResult?.detected ? 'none' : 'grayscale(1)'
              }}
            >
              <span style={styles.captureRing}>
                <span style={styles.captureInner} />
              </span>
              {faceResult?.detected ? 'Capture Selfie (Face Detected)' : 'Awaiting Face (Red Box)...'}
            </button>
          </div>
        )}

        {/* ── PREVIEW ── */}
        {stage === 'preview' && capturedImage && (
          <div style={styles.previewSection}>
            <div style={styles.timerBadge}>⏱ {fmtTime(countdown)}</div>
            <p style={styles.hint}>Review your photo — make sure your face is clear and well-lit</p>
            <div style={styles.previewWrapper}>
              <img src={capturedImage} alt="Selfie preview" style={styles.previewImg} />
            </div>
            <div style={styles.previewActions}>
              <button onClick={retake} style={styles.retakeBtn}>↩ Retake</button>
              <button onClick={uploadSelfie} style={styles.submitBtn}>Submit ✓</button>
            </div>
          </div>
        )}

        {/* ── UPLOADING ── */}
        {stage === 'uploading' && (
          <div style={styles.centerBox}>
            <div style={styles.uploadIcon}>🔍</div>
            <p style={{ ...styles.hint, fontWeight: 700, fontSize: '1rem', color: '#1e293b' }}>
              Verifying your face…
            </p>
            <div style={styles.progressTrack}>
              <div style={{ ...styles.progressFill, width: `${uploadProgress}%` }} />
            </div>
            <p style={styles.hint}>{uploadProgress}% complete</p>
          </div>
        )}

        {/* ── SUCCESS ── */}
        {stage === 'success' && (
          <div style={styles.centerBox}>
            <div style={styles.successIcon}>✅</div>
            <h2 style={{ color: '#16a34a', fontWeight: 800, fontSize: '1.4rem', margin: '0 0 8px' }}>
              Attendance Marked!
            </h2>
            <p style={styles.hint}>
              You have been successfully clocked in via QR Selfie. Your desktop will update automatically.
            </p>
            <p style={{ ...styles.hint, fontSize: '0.78rem', color: '#94a3b8', marginTop: 8 }}>
              You can now close this page.
            </p>
          </div>
        )}

        {/* ── ALREADY CLOCKED IN ── */}
        {stage === 'already' && (
          <div style={styles.centerBox}>
            <div style={styles.successIcon}>✅</div>
            <h2 style={{ color: '#2563eb', fontWeight: 800, fontSize: '1.3rem', margin: '0 0 8px' }}>
              Already Clocked In
            </h2>
            <p style={styles.hint}>You have already clocked in today. No further action needed.</p>
          </div>
        )}

        {/* ── EXPIRED ── */}
        {stage === 'expired' && (
          <div style={styles.centerBox}>
            <div style={{ fontSize: '3rem' }}>⌛</div>
            <h2 style={{ color: '#d97706', fontWeight: 800, fontSize: '1.3rem', margin: '0 0 8px' }}>
              QR Code Expired
            </h2>
            <p style={styles.hint}>
              This QR code has expired. Please ask your desktop to generate a new one.
            </p>
          </div>
        )}

        {/* ── ERROR ── */}
        {stage === 'error' && (
          <div style={styles.centerBox}>
            <div style={{ fontSize: '3rem' }}>❌</div>
            <h2 style={{ color: '#dc2626', fontWeight: 800, fontSize: '1.2rem', margin: '0 0 8px' }}>
              Verification Failed
            </h2>
            <p style={styles.hint}>{errorMsg}</p>
            {errorMsg.includes('retake') && (
              <button onClick={retake} style={styles.submitBtn}>↩ Try Again</button>
            )}
          </div>
        )}

      </div>
    </div>
  )
}

// ── Styles ───────────────────────────────────────────────────────────────────
const styles: Record<string, React.CSSProperties> = {
  root: {
    minHeight: '100vh',
    background: 'linear-gradient(145deg, #0f172a 0%, #1e293b 50%, #0f172a 100%)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
    fontFamily: "'Inter', system-ui, sans-serif",
  },
  card: {
    background: '#ffffff',
    borderRadius: '24px',
    padding: '0',
    width: '100%',
    maxWidth: '420px',
    overflow: 'hidden',
    boxShadow: '0 25px 60px rgba(0,0,0,0.4)',
  },
  header: {
    background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)',
    padding: '24px 20px 20px',
    textAlign: 'center',
  },
  logo: {
    display: 'inline-block',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    fontWeight: 900,
    fontSize: '0.85rem',
    letterSpacing: '2px',
    padding: '4px 12px',
    borderRadius: '6px',
    marginBottom: '10px',
  },
  title: {
    color: '#f1f5f9',
    fontWeight: 800,
    fontSize: '1.4rem',
    margin: '0 0 4px',
  },
  subtitle: {
    color: '#94a3b8',
    fontSize: '0.82rem',
    margin: 0,
  },
  centerBox: {
    padding: '40px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '16px',
    textAlign: 'center',
  },
  cameraSection: {
    padding: '16px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  timerBadge: {
    background: '#f1f5f9',
    color: '#0f172a',
    fontWeight: 700,
    fontSize: '0.9rem',
    padding: '6px 16px',
    borderRadius: '20px',
    border: '1px solid #e2e8f0',
  },
  hint: {
    color: '#64748b',
    fontSize: '0.85rem',
    margin: 0,
    lineHeight: 1.5,
    textAlign: 'center',
  },
  videoWrapper: {
    position: 'relative',
    width: '100%',
    maxWidth: '320px',
    aspectRatio: '3/4',
    borderRadius: '20px',
    overflow: 'hidden',
    background: '#000',
    border: '3px solid #6366f1',
    boxShadow: '0 0 0 4px rgba(99,102,241,0.15)',
  },
  video: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    transform: 'scaleX(-1)', // mirror front camera
  },
  ovalGuide: {
    position: 'absolute',
    top: '50%',
    left: '50%',
    transform: 'translate(-50%, -50%)',
    width: '60%',
    aspectRatio: '3/4',
    border: '2px dashed rgba(99,102,241,0.7)',
    borderRadius: '50%',
    pointerEvents: 'none',
  },
  scanLine: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: '3px',
    background: 'linear-gradient(90deg, transparent, #6366f1, transparent)',
    animation: 'scan 2s linear infinite',
    pointerEvents: 'none',
  },
  captureBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
    background: 'linear-gradient(135deg, #6366f1, #8b5cf6)',
    color: '#fff',
    border: 'none',
    borderRadius: '50px',
    padding: '14px 28px',
    fontWeight: 700,
    fontSize: '1rem',
    cursor: 'pointer',
    boxShadow: '0 8px 24px rgba(99,102,241,0.4)',
    transition: 'transform 0.15s',
    width: '100%',
    justifyContent: 'center',
  },
  captureRing: {
    width: '28px',
    height: '28px',
    borderRadius: '50%',
    border: '2px solid rgba(255,255,255,0.6)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  captureInner: {
    width: '14px',
    height: '14px',
    borderRadius: '50%',
    background: '#fff',
  },
  previewSection: {
    padding: '16px 16px 24px',
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    gap: '14px',
  },
  previewWrapper: {
    width: '100%',
    maxWidth: '300px',
    borderRadius: '20px',
    overflow: 'hidden',
    border: '3px solid #10b981',
    boxShadow: '0 0 0 4px rgba(16,185,129,0.15)',
  },
  previewImg: {
    width: '100%',
    display: 'block',
  },
  previewActions: {
    display: 'flex',
    gap: '12px',
    width: '100%',
  },
  retakeBtn: {
    flex: 1,
    padding: '14px',
    border: '1.5px solid #e2e8f0',
    borderRadius: '12px',
    background: '#f8fafc',
    color: '#475569',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
  },
  submitBtn: {
    flex: 2,
    padding: '14px',
    border: 'none',
    borderRadius: '12px',
    background: 'linear-gradient(135deg, #10b981, #059669)',
    color: '#fff',
    fontWeight: 700,
    fontSize: '0.9rem',
    cursor: 'pointer',
    boxShadow: '0 4px 16px rgba(16,185,129,0.35)',
  },
  progressTrack: {
    width: '100%',
    height: '8px',
    borderRadius: '4px',
    background: '#f1f5f9',
    overflow: 'hidden',
  },
  progressFill: {
    height: '100%',
    background: 'linear-gradient(90deg, #6366f1, #8b5cf6)',
    borderRadius: '4px',
    transition: 'width 0.2s ease',
  },
  spinner: {
    width: '48px',
    height: '48px',
    border: '4px solid #e2e8f0',
    borderTop: '4px solid #6366f1',
    borderRadius: '50%',
    animation: 'spin 0.8s linear infinite',
  },
  uploadIcon: { fontSize: '3rem' },
  successIcon: { fontSize: '4rem' },
}
