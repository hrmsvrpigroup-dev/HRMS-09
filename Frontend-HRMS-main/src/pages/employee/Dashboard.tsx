import React, { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { io as ioClient } from 'socket.io-client'
import { attendanceApi, AttendanceItem } from '../../api/attendance.api'
import { LoadingSpinner } from '../../components/shared/LoadingSpinner'
import { useAuthStore } from '../../store/auth.store'
import { triggerHrNotification } from '../../utils/notif'
import { detectFaceInVideo, drawFaceDetectorOverlay, FaceDetectionResult } from '../../utils/faceDetector'
import {
  CalendarDays, Clock, PlayCircle, StopCircle, Coffee, Utensils,
  Briefcase, Timer, Sparkles, CheckCircle2, AlertCircle, CheckSquare,
  UserCircle, Rocket, ChevronRight, Bell, Calendar as CalIcon, Users, Star, X, Info, ShieldAlert,
  Camera, QrCode, ScanLine, RefreshCw, Smartphone, Wifi
} from 'lucide-react'

interface ShiftConfig {
  name: string
  timeRange: string
  duration: string
  timeline: Array<{ label: string; time: string; type: 'START' | 'END' | 'BREAK' | 'LUNCH' | 'DINNER' | 'TIFFIN' }>
  overview: {
    pause: string
    lunch?: string
    dinner?: string
    tiffin?: string
    worked: string
    remaining: string
  }
}

const SHIFT_CONFIGS: Record<string, ShiftConfig> = {
  'General Shift': {
    name: 'General Shift',
    timeRange: '10:00 AM - 06:00 PM',
    duration: '08h 00m',
    timeline: [
      { label: 'Shift Start', time: '10:00 AM', type: 'START' },
      { label: 'Tea Break', time: '11:30 AM - 11:45 AM', type: 'BREAK' },
      { label: 'Lunch Break', time: '01:30 PM - 02:15 PM', type: 'LUNCH' },
      { label: 'Tea Break', time: '04:30 PM - 04:45 PM', type: 'BREAK' },
      { label: 'Shift End', time: '06:00 PM', type: 'END' },
    ],
    overview: {
      pause: '00h 30m',
      lunch: '00h 45m',
      worked: '06h 45m',
      remaining: '01h 15m'
    }
  },
  'Morning Shift': {
    name: 'Morning Shift',
    timeRange: '06:00 AM - 02:00 PM',
    duration: '08h 00m',
    timeline: [
      { label: 'Shift Start', time: '06:00 AM', type: 'START' },
      { label: 'Tea Break', time: '08:00 AM - 08:15 AM', type: 'BREAK' },
      { label: 'Breakfast / Tiffin Break', time: '09:30 AM - 10:00 AM', type: 'TIFFIN' },
      { label: 'Tea Break', time: '12:00 PM - 12:15 PM', type: 'BREAK' },
      { label: 'Shift End', time: '02:00 PM', type: 'END' },
    ],
    overview: {
      pause: '00h 30m',
      tiffin: '00h 30m',
      worked: '07h 00m',
      remaining: '01h 00m'
    }
  },
  'Afternoon Shift': {
    name: 'Afternoon Shift',
    timeRange: '02:00 PM - 10:00 PM',
    duration: '08h 00m',
    timeline: [
      { label: 'Shift Start', time: '02:00 PM', type: 'START' },
      { label: 'Tea Break', time: '04:00 PM - 04:15 PM', type: 'BREAK' },
      { label: 'Lunch/Tiffin Break', time: '05:30 PM - 06:00 PM', type: 'TIFFIN' },
      { label: 'Dinner Break', time: '08:00 PM - 08:45 PM', type: 'DINNER' },
      { label: 'Shift End', time: '10:00 PM', type: 'END' },
    ],
    overview: {
      pause: '00h 15m',
      tiffin: '00h 30m',
      dinner: '00h 45m',
      worked: '06h 30m',
      remaining: '01h 30m'
    }
  },
  'Night Shift': {
    name: 'Night Shift',
    timeRange: '10:00 PM - 06:00 AM',
    duration: '08h 00m',
    timeline: [
      { label: 'Shift Start', time: '10:00 PM', type: 'START' },
      { label: 'Tiffin / Snack Break', time: '12:00 AM - 12:30 AM', type: 'TIFFIN' },
      { label: 'Dinner Break', time: '02:00 AM - 02:45 AM', type: 'DINNER' },
      { label: 'Tea Break', time: '04:30 AM - 04:45 AM', type: 'BREAK' },
      { label: 'Shift End', time: '06:00 AM', type: 'END' },
    ],
    overview: {
      pause: '00h 15m',
      tiffin: '00h 30m',
      dinner: '00h 45m',
      worked: '06h 30m',
      remaining: '01h 30m'
    }
  }
}

export default function Dashboard() {
  const navigate = useNavigate()
  const requestIdlePermission = async () => {
    if ('IdleDetector' in window) {
      try {
        const state = await (window as any).IdleDetector.requestPermission()
        console.log('IdleDetector permission status:', state)
      } catch (err) {
        console.error('Error requesting IdleDetector permission:', err)
      }
    }
  }
  const user = useAuthStore(state => state.user)
  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Employee'
  const [todayStatus, setTodayStatus] = useState<AttendanceItem | null>(null)
  const [loading, setLoading] = useState(true)
  const [clocking, setClocking] = useState(false)
  const [currentTime, setCurrentTime] = useState(new Date())

  // Dashboard modal states
  const [showBreakTips, setShowBreakTips] = useState(false)
  const [selectedBulletin, setSelectedBulletin] = useState<any | null>(null)
  const [showAllBulletins, setShowAllBulletins] = useState(false)
  const [footerModal, setFooterModal] = useState<'PRIVACY' | 'TERMS' | 'SUPPORT' | null>(null)
  const [showClockOutWarning, setShowClockOutWarning] = useState(false)

  // Facial & QR attendance modal states
  const [showFaceModal, setShowFaceModal] = useState(false)
  const [showQrModal, setShowQrModal] = useState(false)
  const [faceProgress, setFaceProgress] = useState(0)
  const [faceScanning, setFaceScanning] = useState(false)
  const [faceError, setFaceError] = useState('')
  const [webcamStream, setWebcamStream] = useState<MediaStream | null>(null)
  const [capturedImage, setCapturedImage] = useState<string | null>(null)
  const [qrScanningMode, setQrScanningMode] = useState(false)
  const [capturedFaceData, setCapturedFaceData] = useState<{ faceImage: string; clockInPhoto?: string } | null>(null)
  const [faceResult, setFaceResult] = useState<FaceDetectionResult | null>(null)
  const faceDetectionLoopRef = useRef<number | null>(null)

  // Mobile QR session state
  const [qrSessionId, setQrSessionId] = useState<string | null>(null)
  const [qrToken, setQrToken] = useState<string>('')
  const [qrImage, setQrImage] = useState<string | null>(null)
  const [qrExpiresAt, setQrExpiresAt] = useState<Date | null>(null)
  const [qrCountdown, setQrCountdown] = useState(120)
  const [qrStatus, setQrStatus] = useState<'idle' | 'loading' | 'ready' | 'verified' | 'failed' | 'expired'>('idle')
  const [qrMobileUrl, setQrMobileUrl] = useState('')
  const qrSocketRef = useRef<ReturnType<typeof ioClient> | null>(null)

  // Idle detection states
  const [showIdleAlert, setShowIdleAlert] = useState(false)
  const [idleSeconds, setIdleSeconds] = useState(0)
  const [totalIdleMinutes, setTotalIdleMinutes] = useState(0)
  const idleTimerRef = React.useRef<ReturnType<typeof setInterval> | null>(null)
  const lastActivityRef = React.useRef<number>(Date.now())
  const idleAlertLoggedRef = React.useRef<boolean>(false)
  const IDLE_THRESHOLD_SECONDS = 120 // 2 minutes

  const shiftName = todayStatus?.shift ? (
    todayStatus.shift.toLowerCase().includes('morning') ? 'Morning Shift' :
    todayStatus.shift.toLowerCase().includes('afternoon') ? 'Afternoon Shift' :
    todayStatus.shift.toLowerCase().includes('night') ? 'Night Shift' :
    'General Shift'
  ) : 'General Shift';

  const currentShiftConfig = SHIFT_CONFIGS[shiftName];

  const bulletins = [
    { id: 1, title: 'System Maintenance', content: 'The HRMS portal will undergo standard updates and database maintenance. During this window, shift logging, leaf request pipelines and profile edits may be temporarily unavailable. Thank you for your cooperation.', date: 'May 30, 2026', time: '11:00 PM - 02:00 AM', tag: 'MAINTENANCE', details: 'Database replication and indexing upgrades are planned to optimize punch speed.' },
    { id: 2, title: 'Annual Reopening Guidelines', content: 'Office physical workspaces are operating at full capacity. Please read the updated desk-booking protocol on the company wiki page. Health guidance remains active.', date: 'May 25, 2026', time: 'All Day', tag: 'OFFICE', details: 'Hot-desking slots can be reserved via the admin seat allocation panel.' },
    { id: 3, title: 'Q2 All-Hands Meeting', content: 'Join us on Zoom for our quarterly company-wide sync. The leadership team will present product roadmaps, credit metrics, and celebrate employee milestones.', date: 'May 20, 2026', time: '02:00 PM - 03:30 PM', tag: 'COMPANY', details: 'Link to Join: https://zoom.us/j/companyallhands (Password: Q2AllHands)' }
  ]

  useEffect(() => {
    const timer = setInterval(() => setCurrentTime(new Date()), 1000)
    return () => clearInterval(timer)
  }, [])

  const fetchTodayStatus = async () => {
    try {
      setLoading(true)
      const res = await attendanceApi.getTodayStatus()
      setTodayStatus(res.data.data)
    } catch {
      console.error('Could not load today shift details.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTodayStatus()

    // Poll for status updates silently in the background every 10 seconds.
    // This allows real-time updates if HR resumes/continues the shift.
    const pollInterval = setInterval(async () => {
      try {
        const res = await attendanceApi.getTodayStatus()
        setTodayStatus(res.data.data)
      } catch {
        // ignore background errors
      }
    }, 10000)

    return () => clearInterval(pollInterval)
  }, [])

  // ── Idle Detection Engine ──────────────────────────────────────────────────
  // Refs track state without triggering re-renders or re-running the effect
  const showIdleAlertRef    = React.useRef(false)
  const idleLogIntervalRef  = React.useRef<ReturnType<typeof setInterval> | null>(null)

  useEffect(() => {
    const isClockedIn  = !!todayStatus?.clockIn
    const isClockedOut = !!todayStatus?.clockOut
    const shouldTrack  = isClockedIn && !isClockedOut

    // ── Cleanup helper ────────────────────────────────────────────────────
    const stopAllTimers = () => {
      if (idleTimerRef.current)    { clearInterval(idleTimerRef.current);    idleTimerRef.current    = null }
      if (idleLogIntervalRef.current) { clearInterval(idleLogIntervalRef.current); idleLogIntervalRef.current = null }
    }

    if (!shouldTrack) {
      stopAllTimers()
      lastActivityRef.current    = Date.now()
      idleAlertLoggedRef.current = false
      showIdleAlertRef.current   = false
      setShowIdleAlert(false)
      setIdleSeconds(0)
      return
    }

    // ── Fresh start whenever clock-in state changes ───────────────────────
    stopAllTimers()
    lastActivityRef.current    = Date.now()   // ← start counting from NOW, not page-load
    idleAlertLoggedRef.current = false
    showIdleAlertRef.current   = false
    setShowIdleAlert(false)
    setIdleSeconds(0)

    // ── Activity reset: fired on any real mouse/keyboard input ─────────────
    // Uses document so it captures events even when a child iframe has focus.
    // Does NOT reset on focus/blur events — window focus is irrelevant;
    // we care only about physical cursor/keyboard movement.
    const onActivity = () => {
      lastActivityRef.current = Date.now()
      if (showIdleAlertRef.current) {
        showIdleAlertRef.current   = false
        idleAlertLoggedRef.current = false
        setShowIdleAlert(false)
        setIdleSeconds(0)
      }
      // Cancel the recurring idle logger — user is back
      if (idleLogIntervalRef.current) {
        clearInterval(idleLogIntervalRef.current)
        idleLogIntervalRef.current = null
      }
    }

    const EVENTS = ['mousemove', 'mousedown', 'keydown', 'keypress', 'touchstart', 'scroll', 'click'] as const
    EVENTS.forEach(ev => document.addEventListener(ev, onActivity, { passive: true }))

    // ── Start a 2-minute recurring idle logger ─────────────────────────────
    // Fires every 2 minutes; each firing logs 2 min of idle to backend.
    const startPeriodicLogger = () => {
      if (idleLogIntervalRef.current) return   // already running
      idleLogIntervalRef.current = setInterval(() => {
        const nowIdle = Math.floor((Date.now() - lastActivityRef.current) / 1000) >= IDLE_THRESHOLD_SECONDS
        if (nowIdle) {
          attendanceApi.logIdle().then(res => {
            setTotalIdleMinutes(res.data.data.idleMinutes)
          }).catch(() => {})
        } else {
          // User moved — stop the periodic logger
          if (idleLogIntervalRef.current) {
            clearInterval(idleLogIntervalRef.current)
            idleLogIntervalRef.current = null
          }
        }
      }, 120_000) // every 2 minutes
    }

    // ── Tick every second: update idle counter, show alert, trigger logger ─
    idleTimerRef.current = setInterval(() => {
      const secondsSinceLast = Math.floor((Date.now() - lastActivityRef.current) / 1000)
      setIdleSeconds(secondsSinceLast)

      if (secondsSinceLast >= IDLE_THRESHOLD_SECONDS) {
        // Show the idle alert overlay
        if (!showIdleAlertRef.current) {
          showIdleAlertRef.current = true
          setShowIdleAlert(true)
        }

        // Log the first 2-minute idle period to backend
        if (!idleAlertLoggedRef.current) {
          idleAlertLoggedRef.current = true
          attendanceApi.logIdle().then(res => {
            setTotalIdleMinutes(res.data.data.idleMinutes)
          }).catch(() => {})
          // Then continue logging every further 2 minutes while still idle
          startPeriodicLogger()
        }
      } else {
        // Under threshold — hide alert if it was showing
        if (showIdleAlertRef.current) {
          showIdleAlertRef.current = false
          setShowIdleAlert(false)
        }
      }
    }, 1_000)

    return () => {
      stopAllTimers()
      EVENTS.forEach(ev => document.removeEventListener(ev, onActivity))
    }
  }, [todayStatus?.clockIn, todayStatus?.clockOut])
  // ─────────────────────────────────────────────────────────────────────────


  const startFaceDetectionLoop = () => {
    if (faceDetectionLoopRef.current) {
      cancelAnimationFrame(faceDetectionLoopRef.current);
    }

    let isBusy = false;
    const detectLoop = async () => {
      const video = document.getElementById('webcam-video') as HTMLVideoElement;
      const canvas = document.getElementById('face-detector-canvas') as HTMLCanvasElement;

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
            console.error('Face detector frame error:', e);
          } finally {
            isBusy = false;
          }
        }
      }
      faceDetectionLoopRef.current = requestAnimationFrame(detectLoop);
    };

    faceDetectionLoopRef.current = requestAnimationFrame(detectLoop);
  };

  const startWebcam = async () => {
    try {
      setFaceError('');
      const stream = await navigator.mediaDevices.getUserMedia({ video: { width: 640, height: 480 } });
      setWebcamStream(stream);
      const video = document.getElementById('webcam-video') as HTMLVideoElement;
      if (video) {
        video.srcObject = stream;
        await new Promise<void>((resolve) => {
          video.onloadedmetadata = () => resolve();
        });
        await video.play();
        startFaceDetectionLoop();
      }
    } catch (err) {
      setFaceError('Could not access camera. Please allow camera permissions and try again.');
    }
  };

  const stopWebcam = () => {
    if (faceDetectionLoopRef.current) {
      cancelAnimationFrame(faceDetectionLoopRef.current);
      faceDetectionLoopRef.current = null;
    }
    if (webcamStream) {
      webcamStream.getTracks().forEach((track) => track.stop());
      setWebcamStream(null);
    }
    setCapturedImage(null);
    setFaceProgress(0);
    setFaceScanning(false);
    setFaceError('');
    setFaceResult(null);
  }

  const captureFrame = () => {
    const video = document.getElementById('webcam-video') as HTMLVideoElement
    const canvas = document.createElement('canvas')
    if (video) {
      canvas.width = video.videoWidth || 400
      canvas.height = video.videoHeight || 300
      const ctx = canvas.getContext('2d')
      if (ctx) {
        ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
        return canvas.toDataURL('image/jpeg')
      }
    }
    return null
  }

  const captureFaceTemplate = (): string | null => {
    const video = document.getElementById('webcam-video') as HTMLVideoElement
    if (!video) return null
    // Use actual video dimensions with safe fallback
    const vw = video.videoWidth || 400
    const vh = video.videoHeight || 300
    const canvas = document.createElement('canvas')
    canvas.width = 40
    canvas.height = 40
    const ctx = canvas.getContext('2d')
    if (!ctx) return null
    // Crop center square of the video to capture the face area
    const size = Math.min(vw, vh)
    const sx = (vw - size) / 2
    const sy = (vh - size) / 2
    ctx.drawImage(video, sx, sy, size, size, 0, 0, 40, 40)
    const imgData = ctx.getImageData(0, 0, 40, 40)
    const data = imgData.data
    const gray: number[] = []
    for (let i = 0; i < data.length; i += 4) {
      const r = data[i]
      const g = data[i + 1]
      const b = data[i + 2]
      gray.push(Math.round(0.299 * r + 0.587 * g + 0.114 * b))
    }
    // Reject blank/all-black captures (camera not ready)
    const mean = gray.reduce((s, v) => s + v, 0) / gray.length
    if (mean < 5) return null
    return JSON.stringify(gray)
  }

  const handleFaceClockIn = async () => {
    requestIdlePermission();

    // Enforce clear human face visibility while clocking in
    if (!faceResult?.detected) {
      setFaceError('⚠️ Human face must be clearly visible inside the outline to clock in. Please face the camera directly in good lighting.');
      return;
    }
    // Check if this is first-time registration or verification
    const isFirstTime = !todayStatus?.hasFaceBaseline

    const img = captureFrame()
    const photoData = img || captureFaceTemplate() || 'live-selfie-captured'
    if (!img) {
      setFaceError('Could not access camera photo frame. Please allow camera permission and try again.')
      return
    }
    setFaceScanning(true)
    setFaceError('')
    setCapturedImage(img)
    
    // Simulate scan animation progress
    let progress = 0
    const interval = setInterval(async () => {
      progress += 20
      setFaceProgress(progress)
      if (progress >= 100) {
        clearInterval(interval)

        try {
          const res = await attendanceApi.clockIn({ faceImage: photoData, clockInPhoto: img })
          const updatedStatus = res.data.data
          setTodayStatus(updatedStatus)
          setShowFaceModal(false)
          stopWebcam()
          triggerHrNotification(`Employee ${fullName} clocked in (Facial Verification).`)
          // isFirstTime captures the state BEFORE the API call
          alert('✅ Live selfie captured! Clock-in confirmed successfully.')
        } catch (err: any) {
          setFaceError(err.response?.data?.message || 'Face verification failed. Please try again.')
          setFaceScanning(false)
          setCapturedImage(null)
          setFaceProgress(0)
        }
      }
    }, 150)
  }

  const handleQrClockIn = async () => {
    requestIdlePermission()
    try {
      const todayDateStr = new Date().toISOString().split('T')[0]
      const qrData = `HRMS-CHECKIN-${todayStatus?.employeeCode || 'EMP'}-${todayDateStr}`
      
      const payload: any = { qrData }
      if (todayStatus?.attendanceType === 'BOTH' && capturedFaceData) {
        payload.faceImage = capturedFaceData.faceImage
        payload.clockInPhoto = capturedFaceData.clockInPhoto
      }

      const res = await attendanceApi.clockIn(payload)
      setTodayStatus(res.data.data)
      setShowQrModal(false)
      setCapturedFaceData(null)
      triggerHrNotification(`Employee ${fullName} clocked in (${todayStatus?.attendanceType === 'BOTH' ? 'Face + QR' : 'QR'} Verification).`)
      alert(todayStatus?.attendanceType === 'BOTH' ? 'Clock-in verified via Face and QR Code scan!' : 'Clock-in verified via QR Code scan!')
    } catch (err: any) {
      alert(err.response?.data?.message || 'QR verification failed.')
    }
  }

  const startQrFlow = async () => {
    setShowQrModal(true)
    setQrStatus('loading')
    setQrCountdown(120)
    setQrImage(null)
    setQrSessionId(null)
    try {
      const res = await attendanceApi.createMobileQrSession()
      const { sessionId, qrCode, expiresAt, mobileUrl } = res.data.data
      setQrSessionId(sessionId)
      setQrImage(qrCode)
      setQrMobileUrl(mobileUrl)
      setQrExpiresAt(new Date(expiresAt))
      setQrCountdown(Math.round((new Date(expiresAt).getTime() - Date.now()) / 1000))
      setQrStatus('ready')

      const backendUrl = import.meta.env.VITE_API_URL?.replace('/api', '') || 'http://localhost:5000'
      const sock = ioClient(backendUrl, { transports: ['websocket', 'polling'] })
      qrSocketRef.current = sock
      sock.on('connect', () => { sock.emit('join-session', sessionId) })
      sock.on('mobile-qr-verified', async () => {
        setQrStatus('verified')
        sock.disconnect()
        try {
          const statusRes = await attendanceApi.getMobileQrStatus(sessionId)
          const { accessToken: at, refreshToken: rt } = statusRes.data.data
          if (at && rt) {
            const { user } = useAuthStore.getState()
            if (user) {
              useAuthStore.getState().setAuth(user, at, rt)
            }
          }
          await fetchTodayStatus()
          triggerHrNotification(`Employee ${fullName} clocked in (Mobile QR Selfie).`)
        } catch { /* ignore */ }
        setTimeout(() => setShowQrModal(false), 2500)
      })
      sock.on('mobile-qr-failed', (data: any) => {
        setQrStatus('failed')
        sock.disconnect()
      })
      sock.on('mobile-qr-expired', () => {
        setQrStatus('expired')
        sock.disconnect()
      })
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to generate QR code.')
      setShowQrModal(false)
      setQrStatus('idle')
    }
  }

  const handleClockIn = async () => {
    requestIdlePermission()
    const type = todayStatus?.attendanceType
    if (type === 'FACIAL' || type === 'BOTH') {
      setShowFaceModal(true)
      setTimeout(() => startWebcam(), 100)
    } else if (type === 'QR') {
      startQrFlow()
    } else {
      setClocking(true)
      try {
        const res = await attendanceApi.clockIn()
        setTodayStatus(res.data.data)
        triggerHrNotification(`Employee ${fullName} clocked in.`)
      } catch (err: any) {
        alert(err.response?.data?.message || 'Failed to clock in.')
      } finally {
        setClocking(false)
      }
    }
  }

  const handleClockOut = async () => {
    setShowClockOutWarning(true)
  }

  const confirmClockOut = async () => {
    setShowClockOutWarning(false)
    // Stop idle tracking when clocking out
    if (idleTimerRef.current) clearInterval(idleTimerRef.current)
    setShowIdleAlert(false)
    setClocking(true)
    try {
      const res = await attendanceApi.clockOut()
      setTodayStatus(res.data.data)
      triggerHrNotification(`Employee ${fullName} clocked out.`)
      alert('✅ Clock-out recorded successfully! Your shift has ended. You may now close this tab.')
      try {
        window.close()
      } catch {
        // Handled if browser restricts window.close
      }
    } catch (err: any) {
      alert(err.response?.data?.message || 'Failed to clock out.')
    } finally {
      setClocking(false)
    }
  }

  // Prevent closing tab during an active shift
  useEffect(() => {
    const isClockedIn = !!todayStatus?.clockIn
    const isClockedOut = !!todayStatus?.clockOut
    const isShiftActive = isClockedIn && !isClockedOut

    if (!isShiftActive) return

    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault()
      e.returnValue = 'Your shift is currently active! Please clock out before closing this tab.'
      return e.returnValue
    }

    window.addEventListener('beforeunload', handleBeforeUnload)
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload)
    }
  }, [todayStatus?.clockIn, todayStatus?.clockOut])

  // QR countdown timer and polling fallback
  useEffect(() => {
    if (qrStatus !== 'ready') return
    if (qrCountdown <= 0) { setQrStatus('expired'); return }
    const t = setTimeout(() => setQrCountdown(c => c - 1), 1000)

    let pollTimer: ReturnType<typeof setTimeout>
    if (qrSessionId && qrCountdown % 3 === 0) {
      pollTimer = setTimeout(async () => {
        try {
          const statusRes = await attendanceApi.getMobileQrStatus(qrSessionId)
          const { status, accessToken: at, refreshToken: rt } = statusRes.data.data
          if (status === 'VERIFIED') {
            setQrStatus('verified')
            qrSocketRef.current?.disconnect()
            const { user } = useAuthStore.getState()
            if (user && at && rt) {
              useAuthStore.getState().setAuth(user, at, rt)
            }
            await fetchTodayStatus()
            triggerHrNotification(`Employee ${fullName} clocked in (Mobile QR Selfie).`)
            setTimeout(() => setShowQrModal(false), 2500)
          } else if (status === 'FAILED') {
            setQrStatus('failed')
            qrSocketRef.current?.disconnect()
          } else if (status === 'EXPIRED') {
            setQrStatus('expired')
            qrSocketRef.current?.disconnect()
          }
        } catch { /* ignore */ }
      }, 0)
    }

    return () => {
      clearTimeout(t)
      if (pollTimer) clearTimeout(pollTimer)
    }
  }, [qrStatus, qrCountdown, qrSessionId])

  const closeQrModal = () => {
    setShowQrModal(false)
    setQrStatus('idle')
    setQrImage(null)
    setQrSessionId(null)
    qrSocketRef.current?.disconnect()
    qrSocketRef.current = null
  }

  if (loading) return <LoadingSpinner />

  const isClockedIn = !!todayStatus?.clockIn
  const isClockedOut = !!todayStatus?.clockOut

  const formatTimeStr = (dateStr: string | undefined) => {
    if (!dateStr) return '--:--'
    return new Date(dateStr).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })
  }

  return (
    <div className="emp-dash">
      <div className="emp-header">
        <div className="emp-title">
          <h1>Employee Self Service</h1>
          <p>Clock in/out shifts, request leaves, review worksheets, and check tasks.</p>
        </div>
        <div className="emp-date-picker" onClick={() => navigate('/employee/attendance')}>
          <CalendarDays size={18} className="text-gray-500" />
          <span>{currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}</span>
          <ChevronRight size={16} className="text-gray-400 rotate-90 ml-2" />
        </div>
      </div>

      <div className="emp-grid">
        {/* LEFT COLUMN */}
        <div className="emp-main-col">
          
          {/* Top Cards: Clock & Timeline */}
          <div className="emp-top-cards">
            {/* Dark Blue Shift Clock */}
            <div className="shift-clock-card">
              <Clock size={48} className="bg-clock-icon" />
              <div className="clock-title">WORKFORCE ACTIVE SHIFT CLOCK</div>
              <div className="clock-time">
                {currentTime.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', second: '2-digit' }).replace(' AM', '').replace(' PM', '')}
                <span className="am-pm">{currentTime.toLocaleTimeString('en-US', { hour12: true }).slice(-2)}</span>
              </div>
              <div className="clock-date">
                {currentTime.toLocaleDateString('en-US', { weekday: 'long', month: 'long', day: 'numeric', year: 'numeric' })}
              </div>
              
              {!isClockedIn ? (
                <button className="btn-clock-in" onClick={handleClockIn} disabled={clocking}>
                  {clocking ? 'CLOCKING...' : 'CLOCK IN'}
                </button>
              ) : !isClockedOut ? (
                <button className="btn-clock-out" onClick={handleClockOut} disabled={clocking}>
                  {clocking ? 'CLOCKING...' : 'CLOCK OUT'}
                </button>
              ) : (
                <div className="btn-clock-done">SHIFT COMPLETED</div>
              )}

              <div className="clock-stats-row">
                <div className="stat-col">
                  <span>Clocked In</span>
                  <strong>{formatTimeStr(todayStatus?.clockIn)}</strong>
                </div>
                <div className="stat-col">
                  <span>Clocked Out</span>
                  <strong>{formatTimeStr(todayStatus?.clockOut)}</strong>
                </div>
                <div className="stat-col">
                  <span>Worked Time</span>
                  <strong>{todayStatus?.totalHours ? `${todayStatus.totalHours}h` : '--:--'}</strong>
                </div>
              </div>
            </div>

            {/* Timeline Card */}
            <div className="timeline-card panel">
              <div className="panel-header">
                <h3>Today's Timeline ({currentShiftConfig.name})</h3>
                <button className="link-blue" onClick={() => navigate('/employee/history')}>View Details</button>
              </div>
              <div className="timeline-list">
                {currentShiftConfig.timeline.map((item, idx) => {
                  let icon = <Coffee size={18} />;
                  let colorClass = 'purple';
                  if (item.type === 'START') {
                    icon = <PlayCircle size={18} />;
                    colorClass = 'green';
                  } else if (item.type === 'END') {
                    icon = <StopCircle size={18} />;
                    colorClass = 'red';
                  } else if (item.type === 'LUNCH' || item.type === 'DINNER') {
                    icon = <Utensils size={18} />;
                    colorClass = 'orange';
                  } else if (item.type === 'TIFFIN') {
                    icon = <Coffee size={18} />;
                    colorClass = 'blue';
                  }
                  return (
                    <div className="timeline-item" key={idx}>
                      <div className={`tl-icon ${colorClass}`}>{icon}</div>
                      <span className="tl-label">{item.label}</span>
                      <span className="tl-time">{item.time}</span>
                    </div>
                  );
                })}
              </div>
              <div className="timeline-total">
                <span>Total Shift Duration</span>
                <strong>{currentShiftConfig.duration}</strong>
              </div>
            </div>
          </div>

          {/* Time Overview Pills */}
          <div className="overview-panel panel">
            <h3 className="panel-title mb-4">Today's Time Overview ({currentShiftConfig.name})</h3>
            <div className="emp-time-overview">
              <div className="overview-pill">
                <div className="pill-icon bg-blue-50 text-blue-500"><Timer size={20} /></div>
                <div className="pill-content">
                  <span className="pill-title">Pause Time</span>
                  <strong className="pill-val">{currentShiftConfig.overview.pause}</strong>
                  <span className="pill-sub">Short Breaks</span>
                </div>
              </div>
              
              {currentShiftConfig.overview.lunch && (
                <div className="overview-pill">
                  <div className="pill-icon bg-orange-50 text-orange-500"><Utensils size={20} /></div>
                  <div className="pill-content">
                    <span className="pill-title">Lunch Time</span>
                    <strong className="pill-val">{currentShiftConfig.overview.lunch}</strong>
                    <span className="pill-sub">Lunch Break</span>
                  </div>
                </div>
              )}

              {currentShiftConfig.overview.dinner && (
                <div className="overview-pill">
                  <div className="pill-icon bg-red-50 text-red-500"><Utensils size={20} /></div>
                  <div className="pill-content">
                    <span className="pill-title">Dinner Time</span>
                    <strong className="pill-val">{currentShiftConfig.overview.dinner}</strong>
                    <span className="pill-sub">Dinner Break</span>
                  </div>
                </div>
              )}

              {currentShiftConfig.overview.tiffin && (
                <div className="overview-pill">
                  <div className="pill-icon bg-purple-50 text-purple-500"><Coffee size={20} /></div>
                  <div className="pill-content">
                    <span className="pill-title">Tiffin Time</span>
                    <strong className="pill-val">{currentShiftConfig.overview.tiffin}</strong>
                    <span className="pill-sub">Snacks/Tea</span>
                  </div>
                </div>
              )}

              <div className="overview-pill">
                <div className="pill-icon bg-green-50 text-green-500"><Briefcase size={20} /></div>
                <div className="pill-content">
                  <span className="pill-title">Worked Time</span>
                  <strong className="pill-val">{currentShiftConfig.overview.worked}</strong>
                  <span className="pill-sub">Actual Working</span>
                </div>
              </div>
              
              <div className="overview-pill">
                <div className="pill-icon bg-red-50 text-red-500"><Clock size={20} /></div>
                <div className="pill-content">
                  <span className="pill-title">Remaining Time</span>
                  <strong className="pill-val">{currentShiftConfig.overview.remaining}</strong>
                  <span className="pill-sub">To Shift End</span>
                </div>
              </div>
            </div>
          </div>

          {/* Suggestions Row */}
          <div className="suggestions-container">
            <h3 className="panel-title mb-4 flex items-center gap-2">
              <Sparkles size={18} className="text-blue-500" /> Suggestions & Improvements
            </h3>
            <div className="emp-suggestions-grid">
              <div className="sugg-card green-card">
                <div className="sugg-icon"><CheckCircle2 size={20} /></div>
                <h4>Keep it up!</h4>
                <p>You are consistent with your attendance this week.</p>
                <button className="sugg-btn" onClick={() => navigate('/employee/attendance')}>View Attendance</button>
              </div>
              <div className="sugg-card purple-card">
                <div className="sugg-icon"><Coffee size={20} /></div>
                <h4>Take Regular Breaks</h4>
                <p>Great! You are taking breaks. Ensure eye and body relaxation.</p>
                <button className="sugg-btn" onClick={() => setShowBreakTips(true)}>Learn More</button>
              </div>
              <div className="sugg-card red-card">
                <div className="sugg-icon"><CheckSquare size={20} /></div>
                <h4>Complete Your Tasks</h4>
                <p>You have pending checklist items. Stay on track!</p>
                <button className="sugg-btn" onClick={() => navigate('/employee/tasks')}>View Tasks</button>
              </div>
              <div className="sugg-card orange-card">
                <div className="sugg-icon"><UserCircle size={20} /></div>
                <h4>Update Your Profile</h4>
                <p>Your profile is 90% complete. Add financial bank details.</p>
                <button className="sugg-btn" onClick={() => navigate('/employee/profile')}>Update Now</button>
              </div>
            </div>
          </div>

          {/* Productivity Banner */}
          <div className="productivity-banner panel">
            <div className="banner-left">
              <div className="rocket-icon"><Rocket size={24} /></div>
              <div>
                <h4>Boost Your Productivity</h4>
                <p>Plan your day, prioritize tasks and achieve your goals.</p>
              </div>
            </div>
            <button className="btn-outline-blue" onClick={() => navigate('/employee/tasks')}>Go to My Tasks</button>
          </div>

          {/* Footer */}
          <footer className="emp-footer">
            <div className="copyright">© 2026 HRMS Platform. All rights reserved.</div>
            <div className="footer-links">
              <button className="foot-link" onClick={() => setFooterModal('PRIVACY')}>Privacy Policy</button>
              <span className="sep">|</span>
              <button className="foot-link" onClick={() => setFooterModal('TERMS')}>Terms of Service</button>
              <span className="sep">|</span>
              <button className="foot-link" onClick={() => setFooterModal('SUPPORT')}>Support</button>
            </div>
          </footer>
        </div>

        {/* RIGHT COLUMN */}
        <div className="emp-side-col">
          
          <div className="panel">
            <h3 className="panel-title">Employee Self Operations</h3>
            <p className="panel-desc">Submit timeoff requests, download monthly PDF payslips, audit document verification status, or check project allocations.</p>
            <div className="op-links">
              <button className="op-btn" onClick={() => navigate('/employee/leave')}>
                <div className="op-btn-left">
                  <div className="op-icon green-icon"><CalendarDays size={18} /></div>
                  <span>Apply For Leave</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
              <button className="op-btn" onClick={() => navigate('/employee/history')}>
                <div className="op-btn-left">
                  <div className="op-icon blue-icon"><Clock size={18} /></div>
                  <span>My Attendance History</span>
                </div>
                <ChevronRight size={16} className="text-gray-400" />
              </button>
            </div>
          </div>

          <div className="panel">
            <h3 className="panel-title">Company Bulletins</h3>
            <p className="panel-desc">View all company updates and announcements.</p>
            
            {/* Display Top Bulletin */}
            <div className="bulletin-card" onClick={() => setSelectedBulletin(bulletins[0])}>
              <div className="bulletin-icon orange-icon"><Bell size={18} /></div>
              <div className="bulletin-content">
                <h4>{bulletins[0].title}</h4>
                <span>{bulletins[0].date} | {bulletins[0].time}</span>
              </div>
              <ChevronRight size={16} className="text-gray-400" />
            </div>
            
            <button className="link-blue text-sm mt-4 inline-block font-semibold" onClick={() => setShowAllBulletins(true)}>
              View All Bulletins
            </button>
          </div>

          <div className="panel">
            <h3 className="panel-title mb-4 flex items-center gap-2"><CalendarDays size={18} /> My Upcoming</h3>
            <div className="upcoming-list">
              <div className="upcoming-item">
                <div className="up-icon green-icon"><Briefcase size={16} /></div>
                <span className="up-title">Salary Credit</span>
                <span className="up-date">May 31, 2026</span>
              </div>
              <div className="upcoming-item">
                <div className="up-icon blue-icon"><Users size={16} /></div>
                <span className="up-title">Team Meeting</span>
                <span className="up-date">May 30, 2026 | 11:00 AM</span>
              </div>
              <div className="upcoming-item">
                <div className="up-icon purple-icon"><Star size={16} /></div>
                <span className="up-title">Performance Review</span>
                <span className="up-date">June 05, 2026</span>
              </div>
            </div>
            <button className="link-blue text-sm mt-4 inline-block font-semibold" onClick={() => navigate('/employee/attendance')}>
              View Calendar
            </button>
          </div>

        </div>
      </div>

      {/* Break Health Tips Modal */}
      {showBreakTips && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-area">
                <Coffee className="text-purple-500" size={20} />
                <h3>Take Regular Breaks</h3>
              </div>
              <button className="close-btn" onClick={() => setShowBreakTips(false)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="health-tip-block">
                <div className="tip-header">1. Rule of 20-20-20</div>
                <p>Every 20 minutes, look at something at least 20 feet away for at least 20 seconds to reduce eye strain.</p>
              </div>
              <div className="health-tip-block">
                <div className="tip-header">2. Hydration Reminders</div>
                <p>Keep a water bottle on your desk. Aim to drink at least 250ml of water during each break.</p>
              </div>
              <div className="health-tip-block">
                <div className="tip-header">3. Standing & Stretching</div>
                <p>Stand up and perform basic wrist and neck circles. Walk around the room for 2-3 minutes to improve leg blood flow.</p>
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setShowBreakTips(false)}>Understood</button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ CLOCK OUT WARNING MODAL ════════ */}
      {showClockOutWarning && (
        <div className="modal-backdrop" style={{
          background: 'rgba(15, 23, 42, 0.75)',
          backdropFilter: 'blur(8px)',
          zIndex: 9999,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          position: 'fixed',
          top: 0,
          left: 0,
          right: 0,
          bottom: 0,
        }}>
          <div style={{
            background: 'white',
            borderRadius: '20px',
            padding: '2.5rem 2rem 2rem 2rem',
            maxWidth: '480px',
            width: '90%',
            boxShadow: '0 25px 50px -12px rgba(0, 0, 0, 0.25)',
            textAlign: 'center',
            position: 'relative',
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: '1.5rem'
          }}>
            {/* Warning Icon Badge */}
            <div style={{
              width: '64px',
              height: '64px',
              borderRadius: '50%',
              background: '#fef2f2',
              border: '2px solid #fee2e2',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: '#ef4444',
            }}>
              <ShieldAlert size={36} />
            </div>

            <div>
              <h2 style={{
                color: '#0f172a',
                fontSize: '1.4rem',
                fontWeight: 800,
                margin: '0 0 0.5rem 0',
              }}>
                Confirm Clock Out?
              </h2>
              <p style={{
                color: '#64748b',
                fontSize: '0.92rem',
                lineHeight: 1.5,
                margin: 0,
              }}>
                Are you sure you want to end your shift? Once you clock out, you will not be able to clock back in today without HR/Admin approval.
              </p>
            </div>

            {/* Warning details banner */}
            <div style={{
              background: '#fef3c7',
              border: '1px solid #fde68a',
              borderRadius: '12px',
              padding: '0.8rem 1rem',
              fontSize: '0.82rem',
              color: '#92400e',
              textAlign: 'left',
              width: '100%',
              display: 'flex',
              alignItems: 'flex-start',
              gap: '0.6rem',
              lineHeight: 1.4,
            }}>
              <Info size={16} style={{ flexShrink: 0, marginTop: '2px' }} />
              <span>
                <strong>Note:</strong> If you accidentally clicked clock out, please click <strong>Cancel</strong> below to keep your shift active.
              </span>
            </div>

            {/* Actions */}
            <div style={{ display: 'flex', gap: '0.75rem', width: '100%' }}>
              <button
                onClick={() => setShowClockOutWarning(false)}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  borderRadius: '10px',
                  border: '1px solid #cbd5e1',
                  background: 'white',
                  color: '#475569',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#f8fafc')}
                onMouseOut={(e) => (e.currentTarget.style.background = 'white')}
              >
                Cancel
              </button>
              <button
                onClick={confirmClockOut}
                disabled={clocking}
                style={{
                  flex: 1,
                  padding: '0.8rem',
                  borderRadius: '10px',
                  border: 'none',
                  background: '#ef4444',
                  color: 'white',
                  fontWeight: 700,
                  fontSize: '0.88rem',
                  cursor: 'pointer',
                  boxShadow: '0 4px 12px rgba(239, 68, 68, 0.2)',
                  transition: 'background 0.2s',
                }}
                onMouseOver={(e) => (e.currentTarget.style.background = '#dc2626')}
                onMouseOut={(e) => (e.currentTarget.style.background = '#ef4444')}
              >
                {clocking ? 'CLOCKING OUT...' : 'Yes, Clock Out'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ════════ IDLE DETECTION ALERT MODAL ════════ */}
      {showIdleAlert && (
        <div className="modal-backdrop" style={{
          background: 'rgba(0,0,0,0.85)',
          backdropFilter: 'blur(12px)',
          zIndex: 9999,
        }}>
          <div style={{
            background: 'linear-gradient(145deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
            border: '1px solid rgba(239,68,68,0.4)',
            borderRadius: '24px',
            padding: '2.5rem',
            maxWidth: '460px',
            width: '90%',
            boxShadow: '0 0 60px rgba(239,68,68,0.25), 0 25px 50px rgba(0,0,0,0.6)',
            position: 'relative',
            overflow: 'hidden',
            animation: 'idle-pulse 2s ease-in-out infinite',
          }}>
            {/* Animated glow ring */}
            <div style={{
              position: 'absolute', top: '-40px', right: '-40px',
              width: '160px', height: '160px',
              borderRadius: '50%',
              background: 'radial-gradient(circle, rgba(239,68,68,0.3) 0%, transparent 70%)',
              animation: 'idle-glow 1.5s ease-in-out infinite alternate',
            }} />

            {/* Icon */}
            <div style={{
              display: 'flex', flexDirection: 'column', alignItems: 'center',
              gap: '1rem', textAlign: 'center',
            }}>
              <div style={{
                width: '80px', height: '80px', borderRadius: '50%',
                background: 'linear-gradient(135deg, rgba(239,68,68,0.2), rgba(239,68,68,0.05))',
                border: '2px solid rgba(239,68,68,0.5)',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                fontSize: '2.4rem',
                boxShadow: '0 0 30px rgba(239,68,68,0.3)',
              }}>
                😴
              </div>

              <div>
                <h2 style={{
                  color: '#f87171',
                  fontSize: '1.5rem',
                  fontWeight: 800,
                  margin: 0,
                  letterSpacing: '-0.5px',
                }}>
                  Are you still there?
                </h2>
                <p style={{
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '0.9rem',
                  marginTop: '0.4rem',
                }}>
                  No activity detected on your workstation
                </p>
              </div>

              {/* Idle counter */}
              <div style={{
                background: 'rgba(239,68,68,0.1)',
                border: '1px solid rgba(239,68,68,0.3)',
                borderRadius: '16px',
                padding: '1.2rem 2rem',
                width: '100%',
              }}>
                <div style={{
                  fontSize: '3rem',
                  fontWeight: 900,
                  color: '#f87171',
                  fontFamily: 'monospace',
                  letterSpacing: '2px',
                  lineHeight: 1,
                }}>
                  {String(Math.floor(idleSeconds / 60)).padStart(2, '0')}:{String(idleSeconds % 60).padStart(2, '0')}
                </div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '0.75rem', marginTop: '0.4rem' }}>
                  IDLE DURATION
                </div>
              </div>

              {totalIdleMinutes > 0 && (
                <div style={{
                  background: 'rgba(255,165,0,0.1)',
                  border: '1px solid rgba(255,165,0,0.3)',
                  borderRadius: '12px',
                  padding: '0.75rem 1.25rem',
                  fontSize: '0.85rem',
                  color: '#fbbf24',
                  display: 'flex',
                  alignItems: 'center',
                  gap: '0.5rem',
                }}>
                  ⚠️ <strong>{totalIdleMinutes} min</strong> total idle time logged today
                </div>
              )}

              <p style={{
                color: 'rgba(255,255,255,0.5)',
                fontSize: '0.8rem',
                margin: 0,
              }}>
                This idle period has been recorded in your attendance report.
                Move your mouse or press any key to resume.
              </p>

              {/* Actions */}
              <div style={{ display: 'flex', gap: '1rem', width: '100%' }}>
                <button
                  onClick={() => {
                    requestIdlePermission()
                    lastActivityRef.current = Date.now()
                    setShowIdleAlert(false)
                    idleAlertLoggedRef.current = false
                    setIdleSeconds(0)
                  }}
                  style={{
                    flex: 2,
                    padding: '0.9rem',
                    borderRadius: '12px',
                    border: 'none',
                    background: 'linear-gradient(135deg, #10b981, #059669)',
                    color: '#fff',
                    fontWeight: 700,
                    fontSize: '0.95rem',
                    cursor: 'pointer',
                    boxShadow: '0 4px 15px rgba(16,185,129,0.3)',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.transform = 'scale(1.03)')}
                  onMouseLeave={e => (e.currentTarget.style.transform = 'scale(1)')}
                >
                  ✅ I'm Back — Resume
                </button>
                <button
                  onClick={handleClockOut}
                  style={{
                    flex: 1,
                    padding: '0.9rem',
                    borderRadius: '12px',
                    border: '1px solid rgba(239,68,68,0.4)',
                    background: 'rgba(239,68,68,0.1)',
                    color: '#f87171',
                    fontWeight: 600,
                    fontSize: '0.85rem',
                    cursor: 'pointer',
                    transition: 'transform 0.15s',
                  }}
                  onMouseEnter={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.2)')}
                  onMouseLeave={e => (e.currentTarget.style.background = 'rgba(239,68,68,0.1)')}
                >
                  Clock Out
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Facial Attendance Scan Modal */}
      {showFaceModal && (
        <div className="modal-backdrop">
          <div className="modal-card select-card" style={{ maxWidth: '480px' }}>
            <div className="modal-header">
              <div className="modal-title-area">
                <Camera className="text-blue-500" size={20} />
                <h3>Live Selfie Attendance</h3>
              </div>
              <button className="close-btn" onClick={() => { setShowFaceModal(false); stopWebcam(); }}><X size={20} /></button>
            </div>
            <div className="modal-body text-center">
              <p className="text-sm text-gray-500 mb-4">
                Capture your live selfie via the web camera to clock-in.
              </p>
              
              <div className="face-scan-viewport-wrapper">
                <div className="face-scan-viewport" style={{ width: '100%', height: '280px', position: 'relative' }}>
                  {/* Live Video */}
                  {!capturedImage && (
                    <video id="webcam-video" width="100%" height="100%" playsInline muted className="webcam-feed" />
                  )}
                  {/* Snapped Image during scan */}
                  {capturedImage && (
                    <img src={capturedImage} alt="Captured frame" className="webcam-feed" />
                  )}

                  {/* High-Tech Face Detector Overlay Canvas */}
                  {!capturedImage && (
                    <canvas
                      id="face-detector-canvas"
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
                  )}

                  {faceScanning && (
                    <div className="laser-line-anim" style={{ zIndex: 15 }} />
                  )}
                </div>

                {/* Real-Time Live Status Feedback Pill */}
                {!capturedImage && (
                  <div
                    style={{
                      marginTop: '12px',
                      padding: '8px 14px',
                      borderRadius: '8px',
                      fontSize: '0.78rem',
                      fontWeight: 600,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: '8px',
                      transition: 'all 0.2s ease',
                      background: faceResult?.detected ? '#ecfdf5' : '#fef2f2',
                      color: faceResult?.detected ? '#065f46' : '#991b1b',
                      border: faceResult?.detected ? '1px solid #a7f3d0' : '1px solid #fecaca'
                    }}
                  >
                    <span style={{ fontSize: '1rem' }}>{faceResult?.detected ? '🟢' : '🔴'}</span>
                    <span>
                      {faceResult?.detected
                        ? `Face Visible & Detected (Green Box) — Ready to Clock In`
                        : `Face Not Visible (Red Box) — Green Box only allowed to Clock In`}
                    </span>
                  </div>
                )}

                {faceScanning && (
                  <div className="scan-progress-bar">
                    <div className="scan-progress-fill" style={{ width: `${faceProgress}%` }} />
                    <span className="scan-progress-text">ANALYZING FACIAL METRICS: {faceProgress}%</span>
                  </div>
                )}
              </div>

              {faceError && (
                <div className="error-tip flex items-center justify-center gap-2 mt-4 text-red-500 font-semibold text-xs">
                  <AlertCircle size={16} />
                  <span>{faceError}</span>
                </div>
              )}
            </div>
            <div className="modal-footer" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <button 
                type="button"
                className="btn-outline"
                onClick={() => {
                  setShowFaceModal(false)
                  stopWebcam()
                  startQrFlow()
                }}
                disabled={faceScanning}
                style={{ display: 'flex', alignItems: 'center', gap: '6px' }}
              >
                <QrCode size={16} /> Use QR Code
              </button>
              <div style={{ display: 'flex', gap: '8px' }}>
                <button 
                  type="button" 
                  className="btn-outline" 
                  onClick={() => { setShowFaceModal(false); stopWebcam(); }}
                  disabled={faceScanning}
                >
                  Cancel
                </button>
                <button 
                  type="button" 
                  className="btn-primary" 
                  onClick={handleFaceClockIn}
                  disabled={faceScanning || !faceResult?.detected}
                  style={{
                    background: faceResult?.detected 
                      ? 'linear-gradient(135deg, #10b981 0%, #059669 100%)' 
                      : '#ef4444',
                    cursor: faceResult?.detected ? 'pointer' : 'not-allowed',
                    opacity: faceResult?.detected ? 1 : 0.65,
                    display: 'flex',
                    alignItems: 'center',
                    gap: '6px'
                  }}
                  title={faceResult?.detected ? 'Green box verified: Click to clock in' : 'Red box active: Human face must be visible to clock in'}
                >
                  {faceScanning 
                    ? 'SCANNING...' 
                    : faceResult?.detected 
                      ? (todayStatus?.hasFaceBaseline ? '✓ Clock In (Face Detected)' : '✓ Register & Clock In')
                      : 'Awaiting Face (Red Box)...'}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ════════ MOBILE QR SELFIE ATTENDANCE MODAL ════════ */}
      {showQrModal && (
        <div className="modal-backdrop">
          <div className="modal-card select-card" style={{ maxWidth: '460px' }}>
            {/* Header */}
            <div className="modal-header" style={{ background: 'linear-gradient(135deg, #1e293b 0%, #0f172a 100%)', borderRadius: '12px 12px 0 0', padding: '18px 20px' }}>
              <div className="modal-title-area">
                <Smartphone className="text-indigo-400" size={20} />
                <h3 style={{ color: '#f1f5f9', margin: 0 }}>Clock In via Mobile QR</h3>
              </div>
              <button className="close-btn" onClick={closeQrModal} style={{ color: '#94a3b8' }}><X size={20} /></button>
            </div>

            <div className="modal-body text-center" style={{ padding: '24px 20px' }}>

              {/* LOADING */}
              {qrStatus === 'loading' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16, padding: '24px 0' }}>
                  <div style={{ width: 52, height: 52, border: '4px solid #e2e8f0', borderTop: '4px solid #6366f1', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
                  <p style={{ color: '#64748b', fontSize: '0.9rem' }}>Generating secure QR code…</p>
                </div>
              )}

              {/* READY — show QR + countdown */}
              {qrStatus === 'ready' && qrImage && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 16 }}>
                  <p style={{ color: '#64748b', fontSize: '0.85rem', margin: 0 }}>
                    Scan this QR code with your mobile camera to open the selfie page
                  </p>

                  {/* QR code box */}
                  <div style={{ background: '#fff', border: '3px solid #6366f1', borderRadius: 16, padding: 12, boxShadow: '0 0 0 6px rgba(99,102,241,0.1)' }}>
                    <img src={qrImage} alt="Mobile Selfie QR Code" style={{ width: 220, height: 220, display: 'block' }} />
                  </div>

                  {/* Countdown badge */}
                  <div style={{
                    display: 'flex', alignItems: 'center', gap: 8,
                    background: qrCountdown < 30 ? '#fef2f2' : '#f0fdf4',
                    border: `1px solid ${qrCountdown < 30 ? '#fecaca' : '#bbf7d0'}`,
                    borderRadius: 20, padding: '8px 20px',
                    color: qrCountdown < 30 ? '#dc2626' : '#16a34a',
                    fontWeight: 700, fontSize: '0.95rem',
                  }}>
                    ⏱ {String(Math.floor(qrCountdown / 60)).padStart(2, '0')}:{String(qrCountdown % 60).padStart(2, '0')}
                    <span style={{ fontWeight: 400, fontSize: '0.78rem', opacity: 0.8 }}>remaining</span>
                  </div>

                  {/* Steps */}
                  <div style={{ background: '#f8fafc', borderRadius: 12, padding: '14px 16px', textAlign: 'left', width: '100%', border: '1px solid #e2e8f0' }}>
                    <p style={{ fontWeight: 700, color: '#1e293b', fontSize: '0.82rem', margin: '0 0 10px' }}>HOW IT WORKS</p>
                    {['Open your phone camera & scan the QR code', 'Allow camera access on mobile', 'Capture your selfie when prompted', 'Desktop will auto clock-in once verified'].map((s, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'flex-start', gap: 10, marginBottom: 8 }}>
                        <span style={{ minWidth: 22, height: 22, borderRadius: '50%', background: '#6366f1', color: '#fff', fontSize: '0.72rem', fontWeight: 700, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
                        <span style={{ color: '#475569', fontSize: '0.82rem', lineHeight: 1.4 }}>{s}</span>
                      </div>
                    ))}
                  </div>

                  {/* Waiting indicator */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#6366f1', fontSize: '0.82rem', fontWeight: 600 }}>
                    <Wifi size={16} />
                    Waiting for mobile verification…
                  </div>
                </div>
              )}

              {/* VERIFIED */}
              {qrStatus === 'verified' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
                  <div style={{ fontSize: '4rem' }}>✅</div>
                  <h3 style={{ color: '#16a34a', fontWeight: 800, margin: 0 }}>Clocked In!</h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Mobile selfie verified successfully. Attendance marked.</p>
                </div>
              )}

              {/* FAILED */}
              {qrStatus === 'failed' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
                  <div style={{ fontSize: '3.5rem' }}>❌</div>
                  <h3 style={{ color: '#dc2626', fontWeight: 800, margin: 0 }}>Verification Failed</h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>Face did not match. Please try again with a new QR code.</p>
                  <button className="btn-primary" onClick={() => { closeQrModal(); handleClockIn(); }} style={{ marginTop: 8 }}>
                    Generate New QR
                  </button>
                </div>
              )}

              {/* EXPIRED */}
              {qrStatus === 'expired' && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 14, padding: '24px 0' }}>
                  <div style={{ fontSize: '3.5rem' }}>⌛</div>
                  <h3 style={{ color: '#d97706', fontWeight: 800, margin: 0 }}>QR Code Expired</h3>
                  <p style={{ color: '#64748b', fontSize: '0.88rem', margin: 0 }}>The 2-minute window has passed. Generate a new QR code.</p>
                  <button className="btn-primary" onClick={() => { closeQrModal(); handleClockIn(); }} style={{ marginTop: 8, background: 'linear-gradient(135deg,#f59e0b,#d97706)' }}>
                    Generate New QR
                  </button>
                </div>
              )}

            </div>

            {/* Footer */}
            {(qrStatus === 'loading' || qrStatus === 'ready') && (
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={closeQrModal}>Cancel</button>
              </div>
            )}
            {(qrStatus === 'verified' || qrStatus === 'failed' || qrStatus === 'expired') && (
              <div className="modal-footer">
                <button type="button" className="btn-outline" onClick={closeQrModal}>Close</button>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Detailed Bulletin Modal */}
      {selectedBulletin && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-area">
                <Bell className="text-orange-500" size={20} />
                <h3>Bulletin: {selectedBulletin.title}</h3>
              </div>
              <button className="close-btn" onClick={() => setSelectedBulletin(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              <div className="bulletin-meta-tag">
                <span>Published: {selectedBulletin.date}</span>
                <span className="tag-pill">{selectedBulletin.tag}</span>
              </div>
              <p className="bulletin-main-content"><strong>Details:</strong> {selectedBulletin.content}</p>
              {selectedBulletin.details && (
                <div className="bulletin-notes">
                  <Info size={16} />
                  <span>{selectedBulletin.details}</span>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setSelectedBulletin(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* All Bulletins Modal */}
      {showAllBulletins && (
        <div className="modal-backdrop">
          <div className="modal-card select-card">
            <div className="modal-header">
              <div className="modal-title-area">
                <Bell className="text-blue-500" size={20} />
                <h3>Company Bulletins Hub</h3>
              </div>
              <button className="close-btn" onClick={() => setShowAllBulletins(false)}><X size={20} /></button>
            </div>
            <div className="modal-body scrollable-body">
              <div className="bulletins-list-stack">
                {bulletins.map(b => (
                  <div key={b.id} className="bulletin-stack-item" onClick={() => { setSelectedBulletin(b); setShowAllBulletins(false); }}>
                    <div className="stack-item-top">
                      <h4>{b.title}</h4>
                      <span className="stack-date">{b.date}</span>
                    </div>
                    <p>{b.content.slice(0, 100)}...</p>
                    <div className="stack-item-footer">
                      <span>Time: {b.time}</span>
                      <span className="click-view">Click to view details &rarr;</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>
            <div className="modal-footer">
              <button className="btn-outline" onClick={() => setShowAllBulletins(false)}>Close</button>
            </div>
          </div>
        </div>
      )}

      {/* Footer Informational Modals */}
      {footerModal && (
        <div className="modal-backdrop">
          <div className="modal-card">
            <div className="modal-header">
              <div className="modal-title-area">
                <ShieldAlert className="text-blue-500" size={20} />
                <h3>
                  {footerModal === 'PRIVACY' && 'Privacy Policy'}
                  {footerModal === 'TERMS' && 'Terms of Service'}
                  {footerModal === 'SUPPORT' && 'Platform Support'}
                </h3>
              </div>
              <button className="close-btn" onClick={() => setFooterModal(null)}><X size={20} /></button>
            </div>
            <div className="modal-body">
              {footerModal === 'PRIVACY' && (
                <div className="footer-doc-content">
                  <p>Our Privacy Policy ensures your data security. Inside the HRMS platform, we log:</p>
                  <ul>
                    <li>Shift Punch Logs & Duration times</li>
                    <li>IP Address and Web Agent for security authentication audits</li>
                    <li>Uploaded Onboarding Credentials (stored securely in database storage)</li>
                  </ul>
                  <p>We do not share your verification or profile details with outside third parties.</p>
                </div>
              )}
              {footerModal === 'TERMS' && (
                <div className="footer-doc-content">
                  <p>By using the HRMS Platform, you agree to comply with organizational conduct rules:</p>
                  <ul>
                    <li>Clock in only for your scheduled shift times.</li>
                    <li>Do not upload unapproved file types or spam requests.</li>
                    <li>Keep your account credentials confidential.</li>
                  </ul>
                </div>
              )}
              {footerModal === 'SUPPORT' && (
                <div className="footer-doc-content">
                  <p>Need platform support or encountered a system bug?</p>
                  <p>You can click on the <strong>Need Help?</strong> button in the sidebar footer to submit an operations ticket directly to the HR Support inbox.</p>
                  <p>Direct Support Email: <code>sysadmin.support@company.com</code></p>
                </div>
              )}
            </div>
            <div className="modal-footer">
              <button className="btn-primary" onClick={() => setFooterModal(null)}>Close</button>
            </div>
          </div>
        </div>
      )}

      <style>{`
        .emp-dash {
          padding: 24px 32px;
          max-width: 1600px;
          margin: 0 auto;
          color: #0f172a;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .emp-header {
          display: flex;
          justify-content: space-between;
          align-items: flex-end;
          margin-bottom: 24px;
        }
        .emp-title h1 { font-size: 1.5rem; font-weight: 800; color: #0f172a; margin: 0 0 4px 0; }
        .emp-title p { color: #64748b; font-size: 0.9rem; margin: 0; }
        .emp-date-picker { 
          padding: 10px 16px; 
          border: 1px solid #e2e8f0; 
          border-radius: 8px; 
          font-weight: 600; 
          font-size: 0.9rem;
          color: #334155;
          display: flex; 
          gap: 10px; 
          align-items: center; 
          background: white;
          cursor: pointer;
          transition: all 0.2s;
        }
        .emp-date-picker:hover {
          border-color: #cbd5e1;
          background: #f8fafc;
        }

        .emp-grid {
          display: grid;
          grid-template-columns: 7fr 3fr;
          gap: 24px;
        }

        .emp-main-col { display: flex; flex-direction: column; gap: 24px; }
        .emp-side-col { display: flex; flex-direction: column; gap: 24px; }

        .panel {
          background: white;
          border-radius: 12px;
          border: 1px solid #f1f5f9;
          padding: 24px;
        }
        
        .panel-title { font-size: 1.05rem; font-weight: 800; margin: 0 0 8px 0; color: #0f172a; }
        .panel-desc { font-size: 0.85rem; color: #64748b; margin: 0 0 16px 0; line-height: 1.5; }
        .panel-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 20px; }
        .panel-header h3 { font-size: 1.05rem; font-weight: 800; margin: 0; }
        
        .link-blue { 
          color: #3b82f6; 
          text-decoration: none; 
          font-size: 0.85rem; 
          font-weight: 600; 
          background: none; 
          border: none; 
          cursor: pointer; 
          padding: 0;
        }
        .link-blue:hover { text-decoration: underline; }

        /* Top Cards */
        .emp-top-cards {
          display: grid;
          grid-template-columns: 1.15fr 0.85fr;
          gap: 24px;
        }

        /* Shift Clock */
        .shift-clock-card {
          background: #192b4d;
          border-radius: 16px;
          padding: 32px 24px;
          position: relative;
          display: flex;
          flex-direction: column;
          align-items: center;
          text-align: center;
          color: white;
          overflow: hidden;
        }
        .bg-clock-icon { position: absolute; right: 24px; top: 24px; color: rgba(255,255,255,0.05); }
        .clock-title { font-size: 0.75rem; font-weight: 700; color: #94a3b8; letter-spacing: 0.1em; margin-bottom: 12px; }
        .clock-time { font-size: 3.5rem; font-weight: 800; color: white; line-height: 1; margin-bottom: 8px; display: flex; align-items: baseline; justify-content: center; gap: 8px; }
        .clock-time .am-pm { font-size: 1.5rem; color: #60a5fa; font-weight: 800; }
        .clock-date { font-size: 0.9rem; color: #94a3b8; font-weight: 500; margin-bottom: 32px; }

        .btn-clock-in {
          background: #10b981;
          color: white;
          border: none;
          padding: 14px 48px;
          border-radius: 8px;
          font-size: 1.1rem;
          font-weight: 800;
          cursor: pointer;
          letter-spacing: 0.05em;
          box-shadow: 0 4px 15px rgba(16, 185, 129, 0.3);
          transition: all 0.2s;
        }
        .btn-clock-in:hover { background: #059669; transform: translateY(-2px); }
        .btn-clock-out { background: #ef4444; color: white; border: none; padding: 14px 48px; border-radius: 8px; font-size: 1.1rem; font-weight: 800; cursor: pointer; letter-spacing: 0.05em; box-shadow: 0 4px 15px rgba(239, 68, 68, 0.3); transition: all 0.2s; }
        .btn-clock-out:hover { background: #dc2626; transform: translateY(-2px); }
        .btn-clock-done { background: rgba(255,255,255,0.1); padding: 14px 48px; border-radius: 8px; font-weight: 800; color: #94a3b8; }

        .clock-stats-row {
          display: flex;
          justify-content: space-between;
          width: 100%;
          margin-top: 40px;
          border-top: 1px solid rgba(255,255,255,0.1);
          padding-top: 24px;
        }
        .stat-col { display: flex; flex-direction: column; gap: 4px; }
        .stat-col span { font-size: 0.75rem; color: #94a3b8; }
        .stat-col strong { font-size: 1rem; color: white; font-family: monospace; font-weight: 600; }

        /* Timeline */
        .timeline-list { display: flex; flex-direction: column; gap: 20px; margin-bottom: 32px; position: relative; }
        .timeline-item { display: flex; align-items: center; justify-content: space-between; position: relative; z-index: 1; }
        .timeline-item::before {
          content: ''; position: absolute; left: 14px; top: 30px; bottom: -20px; width: 1px; background: #e2e8f0; z-index: -1;
        }
        .timeline-item:last-child::before { display: none; }
        
        .tl-icon { width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; color: white; }
        .tl-icon.green { background: #10b981; } .tl-icon.orange { background: #f97316; }
        .tl-icon.purple { background: #8b5cf6; } .tl-icon.red { background: #ef4444; }
        
        .tl-label { flex: 1; margin-left: 16px; font-size: 0.9rem; font-weight: 600; color: #0f172a; }
        .tl-time { font-size: 0.85rem; color: #64748b; font-weight: 500; }

        .timeline-total {
          display: flex;
          justify-content: space-between;
          padding-top: 16px;
          border-top: 1px solid #f1f5f9;
          font-size: 0.95rem;
          font-weight: 700;
        }
        .timeline-total span { color: #0f172a; }
        .timeline-total strong { color: #3b82f6; }

        /* Overview Pills */
        .mb-4 { margin-bottom: 16px; }
        .emp-time-overview {
          display: grid;
          grid-template-columns: repeat(5, 1fr);
          gap: 16px;
        }
        .overview-pill {
          display: flex;
          align-items: center;
          gap: 12px;
          padding: 16px;
          background: #ffffff;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          box-shadow: 0 2px 10px rgba(0,0,0,0.02);
        }
        .pill-icon { width: 40px; height: 40px; border-radius: 50%; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .bg-blue-50 { background: #eff6ff; } .text-blue-500 { color: #3b82f6; }
        .bg-orange-50 { background: #fff7ed; } .text-orange-500 { color: #f97316; }
        .bg-purple-50 { background: #faf5ff; } .text-purple-500 { color: #a855f7; }
        .bg-green-50 { background: #f0fdf4; } .text-green-500 { color: #22c55e; }
        .bg-red-50 { background: #fef2f2; } .text-red-500 { color: #ef4444; }

        .pill-content { display: flex; flex-direction: column; }
        .pill-title { font-size: 0.75rem; font-weight: 700; color: #0f172a; margin-bottom: 2px; }
        .pill-val { font-size: 1.05rem; font-weight: 800; color: #0f172a; margin-bottom: 2px; }
        .pill-sub { font-size: 0.7rem; color: #64748b; font-weight: 500; }

        /* Suggestions */
        .emp-suggestions-grid {
          display: grid;
          grid-template-columns: repeat(4, 1fr);
          gap: 16px;
        }
        .sugg-card {
          padding: 20px;
          border-radius: 12px;
          display: flex;
          flex-direction: column;
        }
        .green-card { background: #f0fdf4; border: 1px solid #bbf7d0; }
        .purple-card { background: #faf5ff; border: 1px solid #e9d5ff; }
        .red-card { background: #fef2f2; border: 1px solid #fecaca; }
        .orange-card { background: #fff7ed; border: 1px solid #fed7aa; }

        .sugg-icon { margin-bottom: 12px; }
        .green-card .sugg-icon { color: #16a34a; }
        .purple-card .sugg-icon { color: #9333ea; }
        .red-card .sugg-icon { color: #dc2626; }
        .orange-card .sugg-icon { color: #ea580c; }

        .sugg-card h4 { margin: 0 0 8px 0; font-size: 0.95rem; font-weight: 700; color: #0f172a; }
        .sugg-card p { margin: 0 0 16px 0; font-size: 0.8rem; color: #475569; line-height: 1.5; flex: 1; }
        
        .sugg-btn { 
          font-size: 0.8rem; 
          font-weight: 700; 
          background: none; 
          border: none; 
          cursor: pointer; 
          text-align: left; 
          padding: 0;
          display: inline-block;
          transition: transform 0.2s;
        }
        .sugg-btn:hover { transform: translateX(2px); text-decoration: underline; }
        .green-card .sugg-btn { color: #16a34a; } .purple-card .sugg-btn { color: #9333ea; }
        .red-card .sugg-btn { color: #dc2626; } .orange-card .sugg-btn { color: #ea580c; }

        /* Productivity Banner */
        .productivity-banner {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 20px 24px;
          background: #f8fafc;
        }
        .banner-left { display: flex; align-items: center; gap: 16px; }
        .rocket-icon { width: 48px; height: 48px; border-radius: 12px; background: white; display: flex; align-items: center; justify-content: center; color: #3b82f6; box-shadow: 0 2px 4px rgba(0,0,0,0.05); }
        .banner-left h4 { margin: 0 0 4px 0; font-size: 1.05rem; font-weight: 800; color: #312e81; }
        .banner-left p { margin: 0; font-size: 0.85rem; color: #475569; }
        .btn-outline-blue { padding: 8px 16px; border: 1px solid #cbd5e1; border-radius: 8px; background: white; color: #3b82f6; font-weight: 700; font-size: 0.85rem; cursor: pointer; }
        .btn-outline-blue:hover { background: #f1f5f9; }

        /* Operations */
        .op-links { display: flex; flex-direction: column; gap: 12px; }
        .op-btn {
          display: flex; justify-content: space-between; align-items: center;
          padding: 16px; background: white; border: 1px solid #e2e8f0; border-radius: 12px;
          cursor: pointer; transition: all 0.2s;
          width: 100%;
        }
        .op-btn:hover { background: #f8fafc; border-color: #cbd5e1; }
        .op-btn-left { display: flex; align-items: center; gap: 12px; font-weight: 600; color: #0f172a; font-size: 0.9rem; }
        .op-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .green-icon { background: #f0fdf4; color: #16a34a; }
        .blue-icon { background: #eff6ff; color: #2563eb; }
        .purple-icon { background: #faf5ff; color: #9333ea; }
        .orange-icon { background: #fff7ed; color: #ea580c; }

        /* Bulletins */
        .bulletin-card {
          display: flex; align-items: center; gap: 12px; padding: 16px; background: #f8fafc; border: 1px solid #e2e8f0; border-radius: 12px; cursor: pointer;
        }
        .bulletin-icon { width: 36px; height: 36px; border-radius: 8px; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
        .bulletin-content { flex: 1; text-align: left; }
        .bulletin-content h4 { margin: 0 0 4px 0; font-size: 0.9rem; font-weight: 700; color: #0f172a; }
        .bulletin-content span { font-size: 0.75rem; color: #64748b; font-weight: 500; }

        /* Upcoming */
        .upcoming-list { display: flex; flex-direction: column; gap: 16px; }
        .upcoming-item { display: flex; align-items: center; justify-content: space-between; }
        .up-icon { width: 32px; height: 32px; border-radius: 8px; display: flex; align-items: center; justify-content: center; }
        .up-title { flex: 1; margin-left: 12px; font-size: 0.9rem; font-weight: 600; color: #0f172a; text-align: left; }
        .up-date { font-size: 0.75rem; color: #64748b; font-weight: 500; }

        /* Footer */
        .emp-footer {
          display: flex;
          justify-content: space-between;
          padding: 24px 0;
          color: #94a3b8;
          font-size: 0.8rem;
          font-weight: 500;
        }
        .footer-links { display: flex; gap: 12px; align-items: center; }
        .foot-link { background: none; border: none; color: #94a3b8; cursor: pointer; font-size: 0.8rem; font-weight: 500; padding: 0; }
        .foot-link:hover { color: #64748b; text-decoration: underline; }
        .footer-links .sep { color: #e2e8f0; }

        /* Modal Overlays */
        .modal-backdrop {
          position: fixed;
          top: 0; left: 0; right: 0; bottom: 0;
          background: rgba(15, 23, 42, 0.4);
          backdrop-filter: blur(4px);
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 1000;
          padding: 20px;
        }

        .modal-card {
          background: white; border-radius: 16px; width: 100%; max-width: 500px; box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1); overflow: hidden;
          animation: modalSlide 0.2s ease-out;
        }
        
        .modal-card.select-card { max-width: 600px; }

        .scrollable-body { max-height: 400px; overflow-y: auto; }

        @keyframes modalSlide {
          from { transform: translateY(15px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        .modal-header {
          padding: 18px 24px; border-bottom: 1px solid #f1f5f9;
          display: flex; justify-content: space-between; align-items: center;
        }

        .modal-title-area { display: flex; align-items: center; gap: 10px; }
        .modal-title-area h3 { margin: 0; font-size: 1.05rem; font-weight: 800; color: #0f172a; }

        .close-btn { background: none; border: none; color: #64748b; cursor: pointer; display: flex; }
        .close-btn:hover { color: #0f172a; }

        .modal-body { padding: 24px; }

        .modal-footer {
          padding: 16px 24px; border-top: 1px solid #f1f5f9;
          display: flex; justify-content: flex-end; gap: 12px;
        }

        .btn-outline { background: white; border: 1px solid #cbd5e1; color: #334155; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
        .btn-outline:hover { background: #f8fafc; }
        .btn-primary { background: #3b82f6; color: white; border: none; padding: 8px 16px; border-radius: 6px; font-size: 0.82rem; font-weight: 700; cursor: pointer; }
        .btn-primary:hover { background: #2563eb; }

        /* Health tips specifically */
        .health-tip-block { margin-bottom: 16px; }
        .health-tip-block:last-child { margin-bottom: 0; }
        .tip-header { font-weight: 800; font-size: 0.9rem; color: #0f172a; margin-bottom: 4px; }
        .health-tip-block p { margin: 0; font-size: 0.82rem; color: #475569; line-height: 1.4; }

        /* Bulletins specific */
        .bulletin-meta-tag { display: flex; justify-content: space-between; font-size: 0.75rem; color: #94a3b8; font-weight: 600; margin-bottom: 12px; }
        .tag-pill { background: #ffe8cc; color: #d9480f; padding: 2px 6px; border-radius: 4px; font-size: 0.68rem; font-weight: 700; }
        .bulletin-main-content { font-size: 0.88rem; color: #334155; line-height: 1.5; margin: 0 0 16px 0; }
        .bulletin-notes { display: flex; gap: 8px; padding: 12px; background: #f8fafc; border-radius: 8px; color: #475569; font-size: 0.8rem; border-left: 3px solid #3b82f6; }

        /* Bulletins list stack */
        .bulletins-list-stack { display: flex; flex-direction: column; gap: 12px; }
        .bulletin-stack-item {
          border: 1px solid #e2e8f0; border-radius: 8px; padding: 14px; cursor: pointer; transition: all 0.2s; background: white;
        }
        .bulletin-stack-item:hover { border-color: #3b82f6; background: #eff6ff; }
        .stack-item-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 6px; }
        .stack-item-top h4 { margin: 0; font-size: 0.9rem; font-weight: 800; color: #0f172a; }
        .stack-date { font-size: 0.72rem; color: #94a3b8; font-weight: 500; }
        .bulletin-stack-item p { margin: 0 0 8px 0; font-size: 0.8rem; color: #475569; line-height: 1.4; }
        .stack-item-footer { display: flex; justify-content: space-between; font-size: 0.72rem; color: #94a3b8; }
        .click-view { color: #3b82f6; font-weight: 700; }

        /* Footer documents */
        .footer-doc-content p { font-size: 0.85rem; color: #334155; line-height: 1.4; margin: 0 0 10px 0; }
        .footer-doc-content ul { padding-left: 20px; font-size: 0.82rem; color: #475569; margin: 0 0 14px 0; }
        .footer-doc-content li { margin-bottom: 6px; }

        /* Face and QR Scanner Styling */
        .face-scan-viewport-wrapper {
          position: relative;
          width: 100%;
          max-width: 320px;
          margin: 0 auto;
        }

        .face-scan-viewport {
          position: relative;
          width: 320px;
          height: 240px;
          border-radius: 12px;
          overflow: hidden;
          background: #090d16;
          border: 2px solid #e2e8f0;
          box-shadow: 0 4px 12px rgba(0,0,0,0.1);
        }

        .qr-scan-viewport {
          border-color: #f97316;
        }

        .webcam-feed {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .face-silhouette {
          position: absolute;
          top: 0; left: 0; right: 0; bottom: 0;
          display: flex; align-items: center; justify-content: center;
          pointer-events: none;
        }

        .face-outline {
          width: 160px;
          height: 200px;
          border: 2px dashed rgba(16, 185, 129, 0.6);
          border-radius: 50% 50% 50% 50% / 60% 60% 40% 40%;
          box-shadow: 0 0 0 9999px rgba(9, 13, 22, 0.4);
        }

        .laser-line-anim {
          position: absolute;
          left: 0;
          width: 100%;
          height: 3px;
          background: linear-gradient(90deg, rgba(16, 185, 129, 0) 0%, #10b981 50%, rgba(16, 185, 129, 0) 100%);
          box-shadow: 0 0 8px #10b981;
          animation: laserScan 2s infinite ease-in-out;
          pointer-events: none;
        }

        @keyframes laserScan {
          0% { top: 10%; }
          50% { top: 90%; }
          100% { top: 10%; }
        }

        .scan-progress-bar {
          margin-top: 16px;
          background: #e2e8f0;
          border-radius: 6px;
          height: 16px;
          position: relative;
          overflow: hidden;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .scan-progress-fill {
          position: absolute;
          left: 0; top: 0; bottom: 0;
          background: #10b981;
          transition: width 0.15s ease-out;
          z-index: 1;
        }

        .scan-progress-text {
          position: relative;
          z-index: 2;
          font-size: 0.68rem;
          font-weight: 800;
          color: #0f172a;
          letter-spacing: 0.05em;
        }

        .qr-container-card {
          border: 1px solid #e2e8f0;
          border-radius: 16px;
          background: #f8fafc;
          padding: 24px;
          display: inline-block;
          box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.05);
        }

        .qr-img-tag {
          width: 180px;
          height: 180px;
          display: block;
          margin: 0 auto;
        }

        .qr-token-label {
          margin-top: 14px;
          font-size: 0.78rem;
          font-weight: 700;
          color: #475569;
          letter-spacing: 0.02em;
        }

        .qr-scanner-box {
          position: absolute;
          top: 40px;
          left: 80px;
          width: 160px;
          height: 160px;
          pointer-events: none;
        }

        .scanner-corner {
          position: absolute;
          width: 20px;
          height: 20px;
          border: 3px solid #f97316;
        }
        .scanner-corner.top-left { top: 0; left: 0; border-right: none; border-bottom: none; }
        .scanner-corner.top-right { top: 0; right: 0; border-left: none; border-bottom: none; }
        .scanner-corner.bottom-left { bottom: 0; left: 0; border-right: none; border-top: none; }
        .scanner-corner.bottom-right { bottom: 0; right: 0; border-left: none; border-top: none; }

        @keyframes idle-pulse {
          0%, 100% { box-shadow: 0 0 60px rgba(239,68,68,0.25), 0 25px 50px rgba(0,0,0,0.6); }
          50% { box-shadow: 0 0 90px rgba(239,68,68,0.5), 0 25px 50px rgba(0,0,0,0.6); }
        }

        @keyframes idle-glow {
          from { opacity: 0.4; transform: scale(0.9); }
          to   { opacity: 1;   transform: scale(1.15); }
        }
      `}</style>
    </div>
  )
}
