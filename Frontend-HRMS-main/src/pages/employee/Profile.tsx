import React, { useState, useEffect } from 'react'
import { useSearchParams } from 'react-router-dom'
import { useAuthStore } from '../../store/auth.store'
import { 
  User, Shield, Briefcase, Landmark, Save, Phone, MapPin, Mail, Award, 
  CheckCircle, Download, Upload, Sparkles, Printer, RefreshCw, Search, 
  Eye, Check, SlidersHorizontal, Image as ImageIcon,
  ZoomIn, ZoomOut, Move, RotateCw, MoveHorizontal, MoveVertical,
  Crop, X, AlertCircle, Lock
} from 'lucide-react'
import { employeeApi } from '../../api/employee.api'
import html2canvas from 'html2canvas'
import { triggerHrNotification } from '../../utils/notif'

interface ProfileData {
  phone: string
  address: string
  emergencyName: string
  emergencyRelation: string
  emergencyPhone: string
  bankName: string
  bankAccount: string
  bankIfsc: string
  manualEmployeeId: string
  manualBloodGroup: string
}

export default function Profile() {
  const user = useAuthStore((state) => state.user)
  const [searchParams, setSearchParams] = useSearchParams()
  const initialTabParam = searchParams.get('tab')?.toUpperCase()
  const [activeTab, setActiveTab] = useState<'PERSONAL' | 'JOB' | 'BANK' | 'IDCARD'>(
    initialTabParam && ['PERSONAL', 'JOB', 'BANK', 'IDCARD'].includes(initialTabParam)
      ? (initialTabParam as any)
      : 'PERSONAL'
  )
  const [success, setSuccess] = useState(false)
  const [employeeDetails, setEmployeeDetails] = useState<any>(null)
  const [isUploading, setIsUploading] = useState(false)

  // Profile data state
  const [profile, setProfile] = useState<ProfileData>({
    phone: '',
    address: '',
    emergencyName: '',
    emergencyRelation: '',
    emergencyPhone: '',
    bankName: '',
    bankAccount: '',
    bankIfsc: '',
    manualEmployeeId: '',
    manualBloodGroup: '',
  })

  const [initialProfile, setInitialProfile] = useState<ProfileData | null>(null)
  const [isSaving, setIsSaving] = useState(false)
  const [saveError, setSaveError] = useState('')

  // HR ID Card Live Studio state
  const [employees, setEmployees] = useState<any[]>([])
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('ME')
  const [employeeSearch, setEmployeeSearch] = useState<string>('')
  const [cardSaveSuccess, setCardSaveSuccess] = useState<boolean>(false)
  const [showPhotoAdjust, setShowPhotoAdjust] = useState<boolean>(true)
  const [showSigAdjust, setShowSigAdjust] = useState<boolean>(false)
  const [rawSigSource, setRawSigSource] = useState<string | null>(null)
  const [sigBgThreshold, setSigBgThreshold] = useState<number>(215)
  const [rawPhotoSource, setRawPhotoSource] = useState<string | null>(null)
  const [photoBgTolerance, setPhotoBgTolerance] = useState<number>(42)

  // Interactive Photo Cropper Modal states
  const [isCropModalOpen, setIsCropModalOpen] = useState<boolean>(false)
  const [rawCropImage, setRawCropImage] = useState<string | null>(null)
  const [cropImgMeta, setCropImgMeta] = useState<{ width: number; height: number; aspect: number }>({ width: 280, height: 280, aspect: 1 })
  const [cropZoom, setCropZoom] = useState<number>(1)
  const [cropPan, setCropPan] = useState<{ x: number; y: number }>({ x: 0, y: 0 })
  const [isPanningCrop, setIsPanningCrop] = useState<boolean>(false)

  const [liveCardData, setLiveCardData] = useState<{
    fullName: string
    designation: string
    employeeCode: string
    phone: string
    bloodGroup: string
    photo: string
    signature: string
    authorizedSignature: string
    showAuthorizedSig: boolean
    photoScale?: number
    photoOffsetX?: number
    photoOffsetY?: number
    photoRotate?: number
    sigScale?: number
    sigOffsetX?: number
    sigOffsetY?: number
    sigRotate?: number
  }>({
    fullName: '',
    designation: '',
    employeeCode: 'HR-0001',
    phone: '',
    bloodGroup: 'O+',
    photo: '',
    signature: '',
    authorizedSignature: '/authorized_signature.png?v=2',
    showAuthorizedSig: true,
    photoScale: 1,
    photoOffsetX: 0,
    photoOffsetY: 0,
    photoRotate: 0,
    sigScale: 1,
    sigOffsetX: 0,
    sigOffsetY: 0,
    sigRotate: 0,
  })

  const getInitials = (name: string) => {
    if (!name || !name.trim()) return 'ID'
    const clean = name.trim().split(/\s+/)
    if (clean.length >= 2) {
      return `${clean[0][0]}${clean[1][0]}`.toUpperCase()
    }
    return clean[0].slice(0, 2).toUpperCase()
  }

  const getAvatarBg = (name: string) => {
    const clean = (name || '').trim().toUpperCase()
    if (clean.includes('PRIYANKA') || clean.includes('PA')) return '#8b264e'
    if (clean.includes('SHIVA') || clean.includes('SP')) return '#93c5fd'
    const palette = ['#8b264e', '#2563eb', '#059669', '#7c3aed', '#d97706', '#0284c7', '#db2777']
    let hash = 0
    for (let i = 0; i < clean.length; i++) {
      hash = (hash << 5) - hash + clean.charCodeAt(i)
    }
    return palette[Math.abs(hash) % palette.length]
  }

  const getAvatarTextColor = (name: string) => {
    const clean = (name || '').trim().toUpperCase()
    if (clean.includes('SHIVA') || clean.includes('SP')) return '#0f172a'
    return '#ffffff'
  }

  useEffect(() => {
    const fetchProfile = async () => {
      try {
        const res = await employeeApi.getProfile()
        const emp = res.data.data
        
        // Check if there is locally saved photo or signature
        const localPhoto = user?.id ? localStorage.getItem(`hrms_photo_${user.id}`) : null
        const localSignature = user?.id ? localStorage.getItem(`hrms_signature_${user.id}`) : null

        setEmployeeDetails({
          ...emp,
          photo: emp.photo || localPhoto || null,
          signature: emp.signature || localSignature || null,
        })

        const initialData: ProfileData = {
          phone: emp.phone || '',
          address: emp.addressInfo?.currentAddress || emp.address || '',
          emergencyName: emp.emergencyContact?.name || '',
          emergencyRelation: emp.emergencyContact?.relationship || '',
          emergencyPhone: emp.emergencyContact?.phone || '',
          bankName: emp.payrollDetails?.bankName || '',
          bankAccount: emp.payrollDetails?.accountNumber || '',
          bankIfsc: emp.payrollDetails?.ifscCode || '',
          manualEmployeeId: emp.employeeCode || (user?.role === 'HR' ? 'HR-0001' : 'EMP-1001'),
          manualBloodGroup: emp.bloodGroup || '',
        }

        // Database is the authoritative source of truth.
        // Only supplement empty fields from local backup without overwriting server coordinates.
        if (user?.id) {
          const saved = localStorage.getItem(`hrms_profile_${user.id}`)
          if (saved) {
            try {
              const parsed = JSON.parse(saved)
              if (!initialData.phone && parsed.phone) initialData.phone = parsed.phone
              if (!initialData.address && parsed.address) initialData.address = parsed.address
              if (!initialData.emergencyName && parsed.emergencyName) initialData.emergencyName = parsed.emergencyName
              if (!initialData.emergencyRelation && parsed.emergencyRelation) initialData.emergencyRelation = parsed.emergencyRelation
              if (!initialData.emergencyPhone && parsed.emergencyPhone) initialData.emergencyPhone = parsed.emergencyPhone
              if (!initialData.bankName && parsed.bankName) initialData.bankName = parsed.bankName
              if (!initialData.bankAccount && parsed.bankAccount) initialData.bankAccount = parsed.bankAccount
              if (!initialData.bankIfsc && parsed.bankIfsc) initialData.bankIfsc = parsed.bankIfsc
              if (!initialData.manualBloodGroup && parsed.manualBloodGroup) initialData.manualBloodGroup = parsed.manualBloodGroup
            } catch (e) {}
          }
        }

        if (user?.role === 'HR' && (!initialData.manualEmployeeId || initialData.manualEmployeeId.includes('CMPW'))) {
          initialData.manualEmployeeId = 'HR-0001'
        }

        setProfile(initialData)
        setInitialProfile(initialData)
      } catch (err) {
        console.warn('Employee profile not found via API, applying account fallback', err)
        if (user) {
          const empCode = (user as any).employeeCode || (user.role === 'HR' ? 'HR-0001' : 'EMP-1001')
          const localPhoto = localStorage.getItem(`hrms_photo_${user.id}`)
          const localSignature = localStorage.getItem(`hrms_signature_${user.id}`)
          
          const defaultEmpDetails = {
            employeeCode: empCode,
            phone: (user as any).phone || '',
            department: { name: user.role === 'HR' ? 'Human Resources' : 'General' },
            designation: { title: user.role === 'HR' ? 'HR Manager' : user.role },
            employmentType: 'FULL_TIME',
            joiningDate: new Date().toISOString(),
            photo: localPhoto || (user as any).photo || null,
            signature: localSignature || null,
          }
          setEmployeeDetails(defaultEmpDetails)

          const initialData: ProfileData = {
            phone: (user as any).phone || '',
            address: (user as any).address || '',
            emergencyName: '',
            emergencyRelation: '',
            emergencyPhone: '',
            bankName: '',
            bankAccount: '',
            bankIfsc: '',
            manualEmployeeId: empCode,
            manualBloodGroup: 'O+',
          }

          if (user.id) {
            const saved = localStorage.getItem(`hrms_profile_${user.id}`)
            if (saved) {
              try {
                const parsed = JSON.parse(saved)
                if (user.role === 'HR' && parsed.manualEmployeeId && (parsed.manualEmployeeId.startsWith('HR-') || parsed.manualEmployeeId.includes('CMPW'))) {
                  parsed.manualEmployeeId = 'HR-0001'
                }
                Object.assign(initialData, parsed)
              } catch (e) {}
            }
          }

          if (user.role === 'HR' && (!initialData.manualEmployeeId || initialData.manualEmployeeId.includes('CMPW'))) {
            initialData.manualEmployeeId = 'HR-0001'
          }

          setProfile(initialData)
          setInitialProfile(initialData)
        }
      }
    }
    fetchProfile()
  }, [user, activeTab])

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsSaving(true)
    setSaveError('')

    try {
      // 1. Persist directly to backend PostgreSQL database
      const payload: any = {
        phone: profile.phone,
        address: profile.address,
        emergencyName: profile.emergencyName,
        emergencyRelation: profile.emergencyRelation,
        emergencyPhone: profile.emergencyPhone,
        bankAccount: profile.bankAccount,
        accountNumber: profile.bankAccount,
        bankIfsc: profile.bankIfsc,
        ifscCode: profile.bankIfsc,
        bloodGroup: profile.manualBloodGroup,
        manualBloodGroup: profile.manualBloodGroup,
      }

      if (isHRUser && profile.bankName) {
        payload.bankName = profile.bankName
      }

      const res = await employeeApi.updateProfile(payload).catch((err) => {
        // Pure administrative accounts without employee profile fallback gracefully
        if (err.response?.status === 404 && user?.role === 'HR') {
          console.warn('Admin user profile saved locally', err)
          return null
        }
        throw err
      })

      if (res?.data?.data) {
        setEmployeeDetails(res.data.data)
      }

      // Calculate changes
      const changes: string[] = []
      if (initialProfile) {
        const labels: Record<string, string> = {
          phone: 'Phone Number',
          address: 'Current Address',
          emergencyName: 'Emergency Contact Person',
          emergencyRelation: 'Emergency Relationship',
          emergencyPhone: 'Emergency Contact Phone',
          bankName: 'Bank Name',
          bankAccount: 'Bank Account Number',
          bankIfsc: 'Bank IFSC Code',
          manualEmployeeId: 'Employee Identifier',
          manualBloodGroup: 'Blood Group',
        }
        Object.keys(profile).forEach((key) => {
          const field = key as keyof ProfileData
          if (profile[field] !== initialProfile[field]) {
            changes.push(`${labels[field] || field}: changed from "${initialProfile[field] || 'empty'}" to "${profile[field] || 'empty'}"`)
          }
        })
      }

      if (changes.length === 0) {
        changes.push('Profile details confirmed and synchronized with database.')
      }

      triggerHrNotification(`Employee ${fullName} updated their profile details.`, {
        employeeName: fullName,
        action: 'Profile Details Update',
        timestamp: new Date().toISOString(),
        changes: changes
      })

      // Update initialProfile to current profile
      setInitialProfile({ ...profile })
      if (user?.id) {
        localStorage.setItem(`hrms_profile_${user.id}`, JSON.stringify(profile))
      }

      setSuccess(true)
      setTimeout(() => setSuccess(false), 3500)
    } catch (err: any) {
      console.error('Failed to save profile changes', err)
      setSaveError(err.response?.data?.message || 'Failed to save profile changes. Please try again.')
    } finally {
      setIsSaving(false)
    }
  }

  // Fetch workspace employees for HR ID card customizer
  useEffect(() => {
    if (user?.role === 'HR') {
      employeeApi.list().then(res => {
        if (res.data?.data) {
          setEmployees(res.data.data)
        }
      }).catch(err => {
        console.warn('Could not fetch employees for ID card studio', err)
      })
    }
  }, [user?.role])

  // Sync default card data for HR / Employee (DB is authoritative for Employees)
  useEffect(() => {
    if (selectedEmployeeId === 'ME') {
      if (user?.role === 'HR') {
        const savedCustom = localStorage.getItem(`hrms_custom_idcard_ME`)
        if (savedCustom) {
          try {
            const parsed = JSON.parse(savedCustom)
            setLiveCardData(parsed)
            return
          } catch (e) {}
        }
      }

      const hrEmpCode = user?.role === 'HR' ? 'HR-0001' : (profile.manualEmployeeId || 'EMP-1001')
      const targetName = fullName || 'Priyanka Avula'
      const targetDesig = employeeDetails?.designation?.title || (user?.role === 'HR' ? 'HR Manager' : roleName)
      const targetPhone = profile.phone || (user as any)?.phone || ''
      const targetBg = profile.manualBloodGroup || 'O+'
      const targetPhoto = employeeDetails?.photo || (user?.id ? localStorage.getItem(`hrms_photo_${user.id}`) : '') || ''
      const targetSig = employeeDetails?.signature || (user?.id ? localStorage.getItem(`hrms_signature_${user.id}`) : '') || ''

      setLiveCardData({
        fullName: targetName,
        designation: targetDesig,
        employeeCode: hrEmpCode,
        phone: targetPhone,
        bloodGroup: targetBg,
        photo: targetPhoto,
        signature: targetSig,
        authorizedSignature: '/authorized_signature.png?v=2',
        showAuthorizedSig: true,
      })
    }
  }, [user, employeeDetails, profile.phone, profile.manualBloodGroup, profile.manualEmployeeId, selectedEmployeeId])

  const handleSelectEmployee = (empId: string) => {
    setSelectedEmployeeId(empId)
    setCardSaveSuccess(false)

    const savedCustom = localStorage.getItem(`hrms_custom_idcard_${empId}`)
    if (savedCustom) {
      try {
        const parsed = JSON.parse(savedCustom)
        const target = empId !== 'ME' ? employees.find(e => e.id === empId) : null
        setLiveCardData({
          photoScale: 1,
          photoOffsetX: 0,
          photoOffsetY: 0,
          photoRotate: 0,
          sigScale: 1,
          sigOffsetX: 0,
          sigOffsetY: 0,
          sigRotate: 0,
          ...parsed,
          photo: parsed.photo ?? target?.photo ?? '',
          signature: parsed.signature ?? target?.signature ?? '',
        })
        return
      } catch (e) {}
    }

    if (empId === 'ME') {
      const hrEmpCode = user?.role === 'HR' ? 'HR-0001' : (profile.manualEmployeeId || 'EMP-1001')
      setLiveCardData({
        fullName: fullName || 'Priyanka Avula',
        designation: employeeDetails?.designation?.title || (user?.role === 'HR' ? 'HR Manager' : roleName),
        employeeCode: hrEmpCode,
        phone: profile.phone || (user as any)?.phone || '',
        bloodGroup: profile.manualBloodGroup || 'O+',
        photo: employeeDetails?.photo || (user?.id ? localStorage.getItem(`hrms_photo_${user.id}`) : '') || '',
        signature: employeeDetails?.signature || (user?.id ? localStorage.getItem(`hrms_signature_${user.id}`) : '') || '',
        authorizedSignature: '/authorized_signature.png?v=2',
        showAuthorizedSig: true,
        photoScale: 1,
        photoOffsetX: 0,
        photoOffsetY: 0,
        photoRotate: 0,
      })
    } else {
      const target = employees.find(e => e.id === empId)
      if (target) {
        setLiveCardData({
          fullName: `${target.firstName || ''} ${target.lastName || ''}`.trim() || 'Employee Name',
          designation: target.designation?.title || 'Employee',
          employeeCode: target.employeeCode || 'EMP-XXXX',
          phone: target.phone || 'N/A',
          bloodGroup: target.bloodGroup || 'N/A',
          photo: target.photo || '',
          signature: target.signature || '',
          authorizedSignature: '/authorized_signature.png?v=2',
          showAuthorizedSig: true,
          photoScale: 1,
          photoOffsetX: 0,
          photoOffsetY: 0,
          photoRotate: 0,
        })

        // Fetch detailed profile for this employee (including photo & signature)
        employeeApi.getById(empId).then(res => {
          const detail = res.data?.data
          if (detail) {
            setLiveCardData(prev => ({
              ...prev,
              photo: detail.photo || prev.photo,
              signature: detail.signature || prev.signature,
              phone: detail.phone || prev.phone,
              bloodGroup: detail.bloodGroup || prev.bloodGroup,
            }))
          }
        }).catch(err => {
          console.warn('Could not fetch single employee details for ID card', err)
        })
      }
    }
  }

  const measureCropImage = (src: string) => {
    const img = new Image()
    img.onload = () => {
      const aspect = img.width / img.height
      setCropImgMeta({ width: img.width, height: img.height, aspect })
    }
    img.src = src
  }

  const handleLivePhotoUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = () => {
      const base64String = reader.result as string
      setRawCropImage(base64String)
      measureCropImage(base64String)
      setCropZoom(1)
      setCropPan({ x: 0, y: 0 })
      setIsCropModalOpen(true)
    }
    e.target.value = ''
  }

  const handleCropMouseDown = (e: React.MouseEvent) => {
    e.preventDefault()
    setIsPanningCrop(true)
    const startX = e.clientX
    const startY = e.clientY
    const initialX = cropPan.x
    const initialY = cropPan.y

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      setCropPan({
        x: initialX + deltaX,
        y: initialY + deltaY,
      })
    }

    const handleMouseUp = () => {
      setIsPanningCrop(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handleCropWheel = (e: React.WheelEvent) => {
    e.preventDefault()
    const delta = e.deltaY < 0 ? 0.05 : -0.05
    setCropZoom(prev => Math.max(0.1, Math.min(3.5, Math.round((prev + delta) * 100) / 100)))
  }

  const applyCrop = () => {
    if (!rawCropImage) return
    const img = new Image()
    img.src = rawCropImage
    img.onload = () => {
      const size = 400
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      if (!ctx) return

      const vpSize = 280
      const ratio = size / vpSize
      const imgAspect = img.width / img.height

      let baseW = vpSize
      let baseH = vpSize
      if (imgAspect > 1) {
        baseH = vpSize
        baseW = vpSize * imgAspect
      } else {
        baseW = vpSize
        baseH = vpSize / imgAspect
      }

      const drawW = baseW * ratio
      const drawH = baseH * ratio

      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)

      ctx.save()
      ctx.translate(size / 2, size / 2)
      ctx.translate(cropPan.x * ratio, cropPan.y * ratio)
      ctx.scale(cropZoom, cropZoom)
      ctx.drawImage(img, -drawW / 2, -drawH / 2, drawW, drawH)
      ctx.restore()

      const croppedBase64 = canvas.toDataURL('image/jpeg', 0.95)
      setLiveCardData(prev => ({
        ...prev,
        photo: croppedBase64,
        photoScale: 1,
        photoOffsetX: 0,
        photoOffsetY: 0,
        photoRotate: 0,
      }))
      setIsCropModalOpen(false)
      setRawCropImage(null)
    }
  }

  const [isDraggingPhoto, setIsDraggingPhoto] = useState<boolean>(false)
  const [isDraggingSig, setIsDraggingSig] = useState<boolean>(false)

  const handleSigMouseDown = (e: React.MouseEvent) => {
    if (user?.role !== 'HR' || !liveCardData.signature) return
    e.preventDefault()
    setIsDraggingSig(true)
    const startX = e.clientX
    const startY = e.clientY
    const initialX = liveCardData.sigOffsetX || 0
    const initialY = liveCardData.sigOffsetY || 0

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const newX = Math.round(initialX + (moveEvent.clientX - startX))
      const newY = Math.round(initialY + (moveEvent.clientY - startY))
      setLiveCardData(prev => ({
        ...prev,
        sigOffsetX: Math.max(-60, Math.min(60, newX)),
        sigOffsetY: Math.max(-40, Math.min(40, newY)),
      }))
    }

    const handleMouseUp = () => {
      setIsDraggingSig(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const handlePhotoMouseDown = (e: React.MouseEvent) => {
    if (user?.role !== 'HR' || !liveCardData.photo) return
    e.preventDefault()
    setIsDraggingPhoto(true)
    const startX = e.clientX
    const startY = e.clientY
    const initialOffsetX = liveCardData.photoOffsetX || 0
    const initialOffsetY = liveCardData.photoOffsetY || 0
    const scale = liveCardData.photoScale || 1

    const handleMouseMove = (moveEvent: MouseEvent) => {
      const deltaX = moveEvent.clientX - startX
      const deltaY = moveEvent.clientY - startY
      const newX = Math.round(initialOffsetX + deltaX / scale)
      const newY = Math.round(initialOffsetY + deltaY / scale)
      setLiveCardData(prev => ({
        ...prev,
        photoOffsetX: Math.max(-150, Math.min(150, newX)),
        photoOffsetY: Math.max(-150, Math.min(150, newY)),
      }))
    }

    const handleMouseUp = () => {
      setIsDraggingPhoto(false)
      window.removeEventListener('mousemove', handleMouseMove)
      window.removeEventListener('mouseup', handleMouseUp)
    }

    window.addEventListener('mousemove', handleMouseMove)
    window.addEventListener('mouseup', handleMouseUp)
  }

  const removeSignatureBackground = (base64Image: string, thresholdHigh = 215): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) {
            resolve(base64Image)
            return
          }
          ctx.drawImage(img, 0, 0)
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imgData.data
          const thresholdLow = Math.max(40, thresholdHigh - 125)

          for (let i = 0; i < d.length; i += 4) {
            const r = d[i]
            const g = d[i + 1]
            const b = d[i + 2]
            const lum = 0.299 * r + 0.587 * g + 0.114 * b

            if (lum >= thresholdHigh) {
              d[i + 3] = 0 // Transparent background
            } else if (lum > thresholdLow) {
              // Smooth anti-aliased edge
              const alphaFactor = 1 - (lum - thresholdLow) / (thresholdHigh - thresholdLow)
              d[i + 3] = Math.max(0, Math.min(255, Math.round(d[i + 3] * alphaFactor)))
            }
          }

          ctx.putImageData(imgData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(base64Image)
        }
      }
      img.onerror = () => resolve(base64Image)
      img.src = base64Image
    })
  }

  const removePhotoBackground = (base64Image: string, tolerance = 42): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image()
      img.crossOrigin = 'anonymous'
      img.onload = () => {
        try {
          const canvas = document.createElement('canvas')
          canvas.width = img.width
          canvas.height = img.height
          const ctx = canvas.getContext('2d')
          if (!ctx) { resolve(base64Image); return }
          ctx.drawImage(img, 0, 0)
          const imgData = ctx.getImageData(0, 0, canvas.width, canvas.height)
          const d = imgData.data
          // Sample top-left and top-right corners to detect solid backdrop color
          const idx1 = 0
          const idx2 = (canvas.width - 1) * 4
          const bgR = Math.round((d[idx1] + d[idx2]) / 2)
          const bgG = Math.round((d[idx1 + 1] + d[idx2 + 1]) / 2)
          const bgB = Math.round((d[idx1 + 2] + d[idx2 + 2]) / 2)
          const feather = tolerance + 18

          for (let i = 0; i < d.length; i += 4) {
            const dist = Math.sqrt(
              (d[i] - bgR) ** 2 + (d[i + 1] - bgG) ** 2 + (d[i + 2] - bgB) ** 2
            )
            if (dist <= tolerance) {
              d[i + 3] = 0
            } else if (dist < feather) {
              const factor = (dist - tolerance) / (feather - tolerance)
              d[i + 3] = Math.round(d[i + 3] * factor)
            }
          }
          ctx.putImageData(imgData, 0, 0)
          resolve(canvas.toDataURL('image/png'))
        } catch {
          resolve(base64Image)
        }
      }
      img.onerror = () => resolve(base64Image)
      img.src = base64Image
    })
  }

  const handleLiveSignatureUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const base64String = reader.result as string
      setRawSigSource(base64String)
      const cleanSig = await removeSignatureBackground(base64String, sigBgThreshold)
      setLiveCardData(prev => ({ ...prev, signature: cleanSig, sigScale: 1, sigOffsetX: 0, sigOffsetY: 0, sigRotate: 0 }))
    }
    e.target.value = ''
  }

  const handleSaveLiveCard = async () => {
    try {
      // 1. Always persist to database first so large base64 images are never blocked by localStorage quota
      if (selectedEmployeeId !== 'ME') {
        const res = await employeeApi.updateIdCard(selectedEmployeeId, {
          fullName: liveCardData.fullName,
          designation: liveCardData.designation,
          employeeCode: liveCardData.employeeCode,
          phone: liveCardData.phone,
          bloodGroup: liveCardData.bloodGroup,
          photo: liveCardData.photo || '',
          signature: liveCardData.signature || '',
        })
        const updatedEmp = res.data?.data
        if (updatedEmp) {
          setEmployees(prev => prev.map(emp => (emp.id === selectedEmployeeId ? { ...emp, ...updatedEmp } : emp)))
        }
      } else if (selectedEmployeeId === 'ME' && user?.id) {
        if (employeeDetails?.id) {
          await employeeApi.updateIdCard(employeeDetails.id, {
            fullName: liveCardData.fullName,
            designation: liveCardData.designation,
            employeeCode: liveCardData.employeeCode,
            phone: liveCardData.phone,
            bloodGroup: liveCardData.bloodGroup,
            photo: liveCardData.photo || '',
            signature: liveCardData.signature || '',
          }).catch(() => {})
        }
        setProfile(prev => ({
          ...prev,
          manualEmployeeId: liveCardData.employeeCode,
          phone: liveCardData.phone,
          manualBloodGroup: liveCardData.bloodGroup,
        }))
        try {
          localStorage.setItem(`hrms_profile_${user.id}`, JSON.stringify({
            ...profile,
            manualEmployeeId: liveCardData.employeeCode,
            phone: liveCardData.phone,
            manualBloodGroup: liveCardData.bloodGroup,
          }))
          if (liveCardData.photo) localStorage.setItem(`hrms_photo_${user.id}`, liveCardData.photo)
          if (liveCardData.signature) localStorage.setItem(`hrms_signature_${user.id}`, liveCardData.signature)
        } catch {}
      }

      // 2. Cache layout/metadata in localStorage safely (never throw QuotaExceededError)
      try {
        const { photo: _p, signature: _s, ...metaOnly } = liveCardData
        const cachePayload = selectedEmployeeId === 'ME' ? liveCardData : metaOnly
        localStorage.setItem(`hrms_custom_idcard_${selectedEmployeeId}`, JSON.stringify(cachePayload))
      } catch {
        // Evict stale idcard cache entries and retry storing metadata only
        try {
          Object.keys(localStorage)
            .filter(k => k.startsWith('hrms_custom_idcard_') && k !== `hrms_custom_idcard_${selectedEmployeeId}`)
            .forEach(k => localStorage.removeItem(k))
          const { photo: _p, signature: _s, ...metaOnly } = liveCardData
          localStorage.setItem(`hrms_custom_idcard_${selectedEmployeeId}`, JSON.stringify(metaOnly))
        } catch {}
      }

      setCardSaveSuccess(true)
      triggerHrNotification(`ID Card for ${liveCardData.fullName} (${liveCardData.employeeCode}) was updated and synced to employee portal.`)
      setTimeout(() => setCardSaveSuccess(false), 3500)
    } catch (err: any) {
      console.error('Failed to save ID card customization', err)
      alert(err?.response?.data?.message || 'Failed to sync ID card changes to employee portal.')
    }
  }

  const handleResetLiveCard = () => {
    localStorage.removeItem(`hrms_custom_idcard_${selectedEmployeeId}`)
    handleSelectEmployee(selectedEmployeeId)
  }

  const handlePrintCard = () => {
    const cardElement = document.getElementById('employee-id-card')
    if (!cardElement) return
    const printWindow = window.open('', '_blank', 'width=800,height=900')
    if (printWindow) {
      printWindow.document.write(`
        <!DOCTYPE html>
        <html>
          <head>
            <title>ID Card - ${liveCardData.employeeCode || 'Badge'}</title>
            <style>
              @page { size: auto; margin: 15mm; }
              body { 
                margin: 0; 
                padding: 20px; 
                display: flex; 
                justify-content: center; 
                align-items: center; 
                background: white; 
                font-family: Arial, sans-serif; 
                -webkit-print-color-adjust: exact;
                print-color-adjust: exact;
              }
              .id-card { 
                width: 330px; 
                min-height: 520px; 
                background: #f4f4f4; 
                border-radius: 12px; 
                box-shadow: none; 
                border: 1px solid #ccc; 
                display: flex; 
                flex-direction: column; 
                overflow: hidden; 
              }
              .id-header { padding: 10px; text-align: center; width: 100%; }
              .id-header img { width: 100%; height: auto; border: 0; }
              .id-photo-container { display: flex; justify-content: center; margin-top: 10px; }
              .id-photo-frame { width: 140px; height: 140px; border-radius: 16px; border: 1px solid #222; overflow: hidden; position: relative; background: white; display: flex; align-items: center; justify-content: center; }
              .id-photo-frame img { position: absolute; top: 50%; left: 50%; width: 100% !important; height: 100% !important; object-fit: cover !important; border: none !important; border-radius: 0 !important; outline: none !important; display: block; }
              .id-photo-badge-hint { display: none !important; }
              .id-avatar-placeholder { 
                width: 140px; 
                height: 140px; 
                border-radius: 16px; 
                display: flex; 
                align-items: center; 
                justify-content: center; 
                font-size: 46px; 
                font-weight: bold; 
                border: 1px solid #222; 
              }
              .id-details { padding: 10px 20px; text-align: center; flex-grow: 1; }
              .id-name { color: #e3000f; font-weight: 700; font-size: 17px; margin-bottom: 2px; text-transform: uppercase; }
              .id-designation { color: #e3000f; font-weight: 600; font-size: 13px; margin-bottom: 20px; }
              .id-info-grid { display: flex; flex-direction: column; gap: 6px; text-align: left; padding: 0 15px 0 45px; }
              .id-info-row { display: flex; font-size: 15px; }
              .id-label { font-weight: 700; width: 125px; color: #000; }
              .id-val { font-weight: 700; color: #000; flex: 1; }
              .id-signatures-row { display: flex; justify-content: space-between; padding: 8px 20px 0; gap: 10px; }
              .id-signature-col { display: flex; flex-direction: column; align-items: center; width: 48%; }
              .id-signature-col.left { align-items: flex-start; padding-left: 10px; }
              .id-signature-col.right { align-items: flex-end; padding-right: 10px; }
              .sig-image-container { height: 35px; margin-bottom: 2px; display: flex; align-items: center; width: 100%; }
              .id-signature-col.left .sig-image-container { justify-content: flex-start; }
              .id-signature-col.right .sig-image-container { justify-content: flex-end; }
              .sig-image-container img { max-height: 35px; max-width: 110px; object-fit: contain; mix-blend-mode: multiply; filter: contrast(1.15); }
              .sig-label-text { font-size: 9px; color: #000; font-weight: 700; }
              .id-footer { width: 100%; }
              .id-footer img { width: 100%; display: block; border: 0; }
            </style>
          </head>
          <body>
            ${cardElement.outerHTML}
            <script>
              window.onload = function() {
                window.print();
              };
            </script>
          </body>
        </html>
      `)
      printWindow.document.close()
    }
  }

  const downloadIdCard = async () => {
    const cardElement = document.getElementById('employee-id-card')
    if (cardElement) {
      // Temporarily hide any editor badge/hint before screenshot
      const badgeHints = cardElement.querySelectorAll<HTMLElement>('.id-photo-badge-hint')
      badgeHints.forEach(el => el.style.setProperty('display', 'none', 'important'))

      try {
        const canvas = await html2canvas(cardElement, { 
          scale: 3, 
          useCORS: true, 
          logging: false,
          ignoreElements: (element) => element.classList?.contains('id-photo-badge-hint') || element.hasAttribute('data-html2canvas-ignore')
        })
        const url = canvas.toDataURL('image/png')
        const link = document.createElement('a')
        const empCode = user?.role === 'HR' ? (liveCardData.employeeCode || 'HR-0001') : (profile.manualEmployeeId || 'Employee')
        link.download = `ID-Card-${empCode}.png`
        link.href = url
        link.click()
      } catch (err) {
        console.error('Failed to generate ID card', err)
      } finally {
        badgeHints.forEach(el => el.style.removeProperty('display'))
      }
    }
  }

  const photoUploadsUsed = employeeDetails?.photoUploadCount ?? (employeeDetails?.photo ? 1 : 0)
  const canUploadPhoto = photoUploadsUsed < 2

  const signatureUploadsUsed = employeeDetails?.signatureUploadCount ?? (employeeDetails?.signature ? 1 : 0)
  const canUploadSignature = signatureUploadsUsed < 2

  const isHRUser = user?.role === 'HR' || (user?.role as string) === 'ADMIN' || (user?.role as string) === 'SUPER_ADMIN'
  const bankEditsUsed = (employeeDetails as any)?.bankEditCount ?? 0
  const canEditBank = isHRUser || bankEditsUsed < 2

  const handleSignatureUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    // Convert file to base64
    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string
      const base64String = await removeSignatureBackground(rawBase64)
      try {
        setIsUploading(true)
        const res = await employeeApi.updateSignature(base64String)
        const updatedCount = res.data?.data?.signatureUploadCount ?? (signatureUploadsUsed + 1)
        setEmployeeDetails((prev: any) => ({
          ...prev,
          signature: res.data?.data?.signature || base64String,
          signatureUploadCount: updatedCount,
        }))
        if (user?.id) {
          localStorage.setItem(`hrms_signature_${user.id}`, base64String)
        }
        triggerHrNotification(`Employee ${fullName} updated their digital signature.`)
      } catch (error: any) {
        console.warn('Backend updateSignature failed, persisting locally', error)
        const updatedCount = (signatureUploadsUsed || 0) + 1
        setEmployeeDetails((prev: any) => ({
          ...prev,
          signature: base64String,
          signatureUploadCount: updatedCount,
        }))
        if (user?.id) {
          localStorage.setItem(`hrms_signature_${user.id}`, base64String)
        }
        triggerHrNotification(`${fullName} updated their digital signature.`)
      } finally {
        setIsUploading(false)
      }
    }
  }

  const handlePhotoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.readAsDataURL(file)
    reader.onloadend = async () => {
      const rawBase64 = reader.result as string
      const base64String = await removeSignatureBackground(rawBase64)
      try {
        setIsUploading(true)
        const res = await employeeApi.updatePhoto(base64String)
        const updatedCount = res.data?.data?.photoUploadCount ?? (photoUploadsUsed + 1)
        setEmployeeDetails((prev: any) => ({
          ...prev,
          photo: res.data?.data?.photo || base64String,
          photoUploadCount: updatedCount,
        }))
        if (user?.id) {
          localStorage.setItem(`hrms_photo_${user.id}`, base64String)
        }
        triggerHrNotification(`Employee ${fullName} updated their profile photo.`)
      } catch (error: any) {
        console.warn('Backend updatePhoto failed, persisting locally', error)
        const updatedCount = (photoUploadsUsed || 0) + 1
        setEmployeeDetails((prev: any) => ({
          ...prev,
          photo: base64String,
          photoUploadCount: updatedCount,
        }))
        if (user?.id) {
          localStorage.setItem(`hrms_photo_${user.id}`, base64String)
        }
        triggerHrNotification(`${fullName} updated their profile photo.`)
      } finally {
        setIsUploading(false)
      }
    }
  }

  const fullName = user ? `${user.firstName} ${user.lastName}` : 'Employee'
  const email = user?.email || ''
  const roleName = user?.role === 'HR' ? 'HR' : user?.role?.replace('_', ' ') || 'EMPLOYEE'

  const filteredEmployeesList = employees.filter((emp) => {
    if (!employeeSearch.trim()) return true
    const q = employeeSearch.toLowerCase()
    const name = `${emp.firstName || ''} ${emp.lastName || ''}`.toLowerCase()
    const code = (emp.employeeCode || '').toLowerCase()
    const dept = (emp.department?.name || '').toLowerCase()
    return name.includes(q) || code.includes(q) || dept.includes(q)
  })

  return (
    <div className="profile-page">
      <div className="profile-header-banner">
        <div className="profile-banner-left">
          {canUploadPhoto ? (
            <label className="profile-avatar-large" style={{ cursor: 'pointer', position: 'relative' }} title={`Click to upload photo (${2 - photoUploadsUsed} upload${2 - photoUploadsUsed === 1 ? '' : 's'} remaining)`}>
              <img src={employeeDetails?.photo || `https://ui-avatars.com/api/?name=${fullName}&background=3b82f6&color=fff&size=128`} alt="User" />
              <input 
                type="file" 
                accept="image/png, image/jpeg" 
                style={{ display: 'none' }} 
                onChange={handlePhotoUpload}
                disabled={isUploading}
              />
              <div className="avatar-hover-overlay">
                <Upload size={20} color="white" />
              </div>
              <span className="upload-badge-tag">{photoUploadsUsed}/2 uploads</span>
            </label>
          ) : (
            <div className="profile-avatar-large" style={{ position: 'relative', cursor: 'default' }} title="Photo upload limit reached (2/2)">
              <img src={employeeDetails?.photo || `https://ui-avatars.com/api/?name=${fullName}&background=3b82f6&color=fff&size=128`} alt="User" />
              <span className="upload-badge-tag locked">2/2 locked</span>
            </div>
          )}
          <div className="profile-header-text">
            <h2>{fullName}</h2>
            <div className="profile-subtitle">
              <span className="role-tag">{roleName}</span>
              <span className="bullet">•</span>
              <span className="dept-tag">{employeeDetails?.department?.name || 'Department'}</span>
            </div>
            <p className="email-line"><Mail size={14} /> {email}</p>
          </div>
        </div>
        <div className="profile-banner-right">
          <div className="profile-completeness">
            <span>Profile Completeness</span>
            <div className="progress-bar-container">
              <div className="progress-bar" style={{ width: '90%' }}></div>
              <span className="progress-val">90%</span>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="profile-tabs">
        <button className={`tab-btn ${activeTab === 'PERSONAL' ? 'active' : ''}`} onClick={() => { setActiveTab('PERSONAL'); setSearchParams({ tab: 'PERSONAL' }, { replace: true }) }}>
          <User size={16} />
          <span>Personal & Contact Info</span>
        </button>
        <button className={`tab-btn ${activeTab === 'JOB' ? 'active' : ''}`} onClick={() => { setActiveTab('JOB'); setSearchParams({ tab: 'JOB' }, { replace: true }) }}>
          <Briefcase size={16} />
          <span>Job & Position Details</span>
        </button>
        <button className={`tab-btn ${activeTab === 'BANK' ? 'active' : ''}`} onClick={() => { setActiveTab('BANK'); setSearchParams({ tab: 'BANK' }, { replace: true }) }}>
          <Landmark size={16} />
          <span>Banking Details</span>
        </button>
        <button className={`tab-btn ${activeTab === 'IDCARD' ? 'active' : ''}`} onClick={() => { setActiveTab('IDCARD'); setSearchParams({ tab: 'IDCARD' }, { replace: true }) }}>
          <User size={16} />
          <span>ID Card</span>
        </button>
      </div>

      {success && (
        <div className="success-toast">
          <CheckCircle size={18} />
          <span>Profile changes saved successfully and synced with HR database!</span>
        </div>
      )}

      {saveError && (
        <div className="error-toast" style={{ background: '#fee2e2', color: '#991b1b', border: '1px solid #f87171', borderRadius: '10px', padding: '14px 18px', marginBottom: '20px', display: 'flex', alignItems: 'center', gap: '10px', fontWeight: 600 }}>
          <AlertCircle size={18} />
          <span>{saveError}</span>
        </div>
      )}

      {/* Form Content */}
      <div className="profile-card">
        <form onSubmit={handleSave}>
          {activeTab === 'PERSONAL' && (
            <div className="tab-pane">
              <h3>Contact Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Employee ID (For ID Card)</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      value={user?.role === 'HR' ? (profile.manualEmployeeId || 'HR-0001') : profile.manualEmployeeId}
                      readOnly
                      style={{ background: '#f1f5f9', cursor: 'not-allowed', color: '#64748b' }}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Blood Group (For ID Card)</label>
                  <div className="input-with-icon">
                    <User size={16} className="input-icon" />
                    <input
                      type="text"
                      value={profile.manualBloodGroup}
                      onChange={(e) => setProfile({ ...profile, manualBloodGroup: e.target.value })}
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Primary Phone Number</label>
                  <div className="input-with-icon">
                    <Phone size={16} className="input-icon" />
                    <input
                      type="text"
                      value={profile.phone}
                      onChange={(e) => setProfile({ ...profile, phone: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group">
                  <label>Permanent Residential Address</label>
                  <div className="input-with-icon">
                    <MapPin size={16} className="input-icon" />
                    <input
                      type="text"
                      value={profile.address}
                      onChange={(e) => setProfile({ ...profile, address: e.target.value })}
                      required
                    />
                  </div>
                </div>
                <div className="form-group readonly">
                  <label>Official Work Email</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="text"
                      value={employeeDetails?.email || user?.email || ''}
                      readOnly
                      style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }}
                    />
                  </div>
                </div>
                <div className="form-group readonly">
                  <label>Registered Personal Email</label>
                  <div className="input-with-icon">
                    <Mail size={16} className="input-icon" />
                    <input
                      type="text"
                      value={employeeDetails?.personalEmail || 'Not Registered'}
                      readOnly
                      style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' }}
                    />
                  </div>
                </div>
              </div>

              <h3 className="section-divider">Emergency Contact Details</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Emergency Contact Person</label>
                  <input
                    type="text"
                    value={profile.emergencyName}
                    onChange={(e) => setProfile({ ...profile, emergencyName: e.target.value })}
                    required
                  />
                </div>
                <div className="form-group">
                  <label>Relationship Status</label>
                  <input
                    type="text"
                    value={profile.emergencyRelation}
                    onChange={(e) => setProfile({ ...profile, emergencyRelation: e.target.value })}
                    required
                  />
                </div>
              </div>
            </div>
          )}

          {activeTab === 'JOB' && (
            <div className="tab-pane readonly">
              <h3>Company Allocation</h3>
              <div className="form-grid">
                <div className="form-group">
                  <label>Employee Identifier</label>
                  <input type="text" value={user?.role === 'HR' ? (profile.manualEmployeeId || 'HR-0001') : (employeeDetails?.employeeCode || profile.manualEmployeeId || '')} readOnly />
                </div>
                <div className="form-group">
                  <label>Role Assignment</label>
                  <input type="text" value={employeeDetails?.designation?.title || (user?.role === 'HR' ? 'HR Manager' : roleName)} readOnly />
                </div>
                <div className="form-group">
                  <label>Reporting Line Manager</label>
                  <input type="text" value={employeeDetails?.manager ? `${employeeDetails.manager.firstName} ${employeeDetails.manager.lastName}` : 'N/A'} readOnly />
                </div>
                <div className="form-group">
                  <label>Joining Date Stamp</label>
                  <input type="text" value={employeeDetails?.joiningDate ? new Date(employeeDetails.joiningDate).toLocaleDateString() : ''} readOnly />
                </div>
                <div className="form-group">
                  <label>Employment Nature</label>
                  <input type="text" value={employeeDetails?.employmentType?.replace('_', ' ') || 'Full-Time'} readOnly />
                </div>
                <div className="form-group">
                  <label>Portal Privilege Level</label>
                  <input type="text" value={user?.role || 'EMPLOYEE_LEVEL_ACCESS'} readOnly />
                </div>
              </div>
              
              <div className="readonly-alert">
                <Shield size={16} />
                <span>Job, organizational and seniority values are managed by HR. If you require changes, please submit an operational request.</span>
              </div>
            </div>
          )}

          {activeTab === 'BANK' && (
            <div className="tab-pane">
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px', flexWrap: 'wrap', gap: '8px' }}>
                <div>
                  <h3 style={{ margin: 0 }}>Direct Deposit Configuration</h3>
                  <p style={{ margin: '4px 0 0', fontSize: '0.85rem', color: '#64748b' }}>
                    Banking coordinates sync automatically with HR Payroll portal for monthly salary crediting.
                  </p>
                </div>
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ display: 'inline-flex', alignItems: 'center', gap: '6px', fontSize: '0.8rem', background: '#dcfce7', color: '#166534', padding: '4px 10px', borderRadius: '12px', fontWeight: 600 }}>
                    <CheckCircle size={14} /> HR Synced
                  </span>
                  {!isHRUser && (
                    <span style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      fontSize: '0.8rem',
                      background: bankEditsUsed >= 2 ? '#fee2e2' : '#e0f2fe',
                      color: bankEditsUsed >= 2 ? '#991b1b' : '#0369a1',
                      padding: '4px 10px',
                      borderRadius: '12px',
                      fontWeight: 600
                    }}>
                      <Shield size={14} />
                      {bankEditsUsed >= 2 ? '2/2 locked' : `${bankEditsUsed}/2 edits used`}
                    </span>
                  )}
                </div>
              </div>

              {!isHRUser && bankEditsUsed >= 2 && (
                <div className="readonly-alert" style={{ marginBottom: '16px', background: '#fef2f2', border: '1px solid #fecaca', color: '#991b1b', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px' }}>
                  <Shield size={18} color="#dc2626" style={{ flexShrink: 0 }} />
                  <span>Bank details edit limit reached (2/2). Banking coordinates are now locked. If you require further updates, please contact HR.</span>
                </div>
              )}

              <div className="form-grid">
                {/* Field 1: Financial Institution Name - Managed by HR */}
                <div className={`form-group ${!isHRUser ? 'readonly' : ''}`}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Financial Institution Name</span>
                    {!isHRUser && (
                      <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                        <Lock size={12} /> Managed by HR
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC Bank, State Bank of India"
                    value={employeeDetails?.payrollDetails?.bankName || profile.bankName || ''}
                    onChange={(e) => isHRUser && setProfile({ ...profile, bankName: e.target.value })}
                    readOnly={!isHRUser}
                    disabled={!isHRUser}
                    style={!isHRUser ? { background: '#f8fafc', cursor: 'not-allowed', color: '#334155', border: '1px solid #cbd5e1' } : {}}
                    required
                  />
                </div>

                {/* Field 2: Bank Routing IFSC Code - Editable by Employee (1 of 2) */}
                <div className={`form-group ${!canEditBank ? 'readonly' : ''}`}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Bank Routing IFSC Code</span>
                    {!isHRUser && (
                      <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                        Editable (1/2)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. HDFC0001234"
                    value={profile.bankIfsc}
                    onChange={(e) => setProfile({ ...profile, bankIfsc: e.target.value.toUpperCase() })}
                    disabled={!canEditBank}
                    style={!canEditBank ? { background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' } : {}}
                    required
                  />
                </div>

                {/* Field 3: Depositor Account Number - Editable by Employee (2 of 2) */}
                <div className={`form-group ${!canEditBank ? 'readonly' : ''}`}>
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>Depositor Account Number</span>
                    {!isHRUser && (
                      <span style={{ fontSize: '0.75rem', color: '#2563eb', fontWeight: 600 }}>
                        Editable (2/2)
                      </span>
                    )}
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. 50100234567890"
                    value={profile.bankAccount}
                    onChange={(e) => setProfile({ ...profile, bankAccount: e.target.value })}
                    disabled={!canEditBank}
                    style={!canEditBank ? { background: '#f8fafc', cursor: 'not-allowed', color: '#64748b' } : {}}
                    required
                  />
                </div>

                {/* Field 4: UAN Number - Strictly Managed by HR Only */}
                <div className="form-group readonly">
                  <label style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                    <span>UAN Number</span>
                    <span style={{ fontSize: '0.75rem', color: '#64748b', fontWeight: 500, display: 'inline-flex', alignItems: 'center', gap: '4px' }}>
                      <Lock size={12} /> Managed by HR Only
                    </span>
                  </label>
                  <input
                    type="text"
                    value={employeeDetails?.payrollDetails?.uanNumber || ''}
                    placeholder="Not Set (Managed by HR)"
                    readOnly
                    disabled
                    style={{ background: '#f8fafc', cursor: 'not-allowed', color: '#0f172a', fontWeight: 600, border: '1px solid #cbd5e1' }}
                  />
                </div>
              </div>

              <div className="readonly-alert" style={{ marginTop: '20px', background: '#f0fdf4', border: '1px solid #bbf7d0', color: '#166534', display: 'flex', alignItems: 'center', gap: '8px', padding: '12px 16px', borderRadius: '8px' }}>
                <Shield size={18} color="#16a34a" style={{ flexShrink: 0 }} />
                <span><strong>UAN Number:</strong> Managed exclusively by HR. Employees do not have permission to edit this field. When updated by HR in the management portal, the verified UAN number reflects here automatically.</span>
              </div>
            </div>
          )}

          {activeTab === 'IDCARD' && (
            <div className="tab-pane">
              {user?.role === 'HR' ? (
                <div className="idcard-studio-layout">
                  {/* Left Column: ID Card Customizer & Controls */}
                  <div className="idcard-controls-panel">
                    <div className="studio-banner">
                      <div className="studio-banner-title">
                        <Sparkles size={18} color="#f59e0b" />
                        <h3>HR ID Card Studio & Batch Customizer</h3>
                        <span className="studio-superpower-badge">⚡ Full Access</span>
                      </div>
                      <p>
                        Live design & management console. Select any personnel across the company to customize their badge details, upload custom photos or signatures, and download or print badges in real time.
                      </p>
                    </div>

                    {cardSaveSuccess && (
                      <div className="success-toast" style={{ margin: 0 }}>
                        <CheckCircle size={18} />
                        <span>ID Card credentials saved successfully for <strong>{liveCardData.fullName}</strong>! Overrides are securely persisted.</span>
                      </div>
                    )}

                    {/* Employee Selector Card */}
                    <div className="studio-card">
                      <div className="studio-card-title">
                        <span>Select Member / Target Personnel</span>
                        <span className="badge-count">{employees.length + 1} Available</span>
                      </div>

                      <div className="employee-search-bar" style={{ marginBottom: '12px', position: 'relative' }}>
                        <Search size={15} style={{ position: 'absolute', left: '12px', top: '50%', transform: 'translateY(-50%)', color: '#64748b' }} />
                        <input
                          type="text"
                          value={employeeSearch}
                          onChange={(e) => setEmployeeSearch(e.target.value)}
                          placeholder="Filter personnel by name, EMP ID, or department..."
                          style={{ paddingLeft: '36px', width: '100%' }}
                        />
                      </div>

                      <div className="form-group">
                        <label>Target Personnel Badge</label>
                        <select 
                          className="studio-select"
                          value={selectedEmployeeId}
                          onChange={(e) => handleSelectEmployee(e.target.value)}
                          style={{
                            width: '100%',
                            padding: '11px 14px',
                            border: '1.5px solid #cbd5e1',
                            borderRadius: '8px',
                            background: '#f8fafc',
                            fontWeight: 600,
                            color: '#1e293b',
                            fontSize: '0.88rem',
                            outline: 'none',
                          }}
                        >
                          <option value="ME">⭐ Current HR Profile: {fullName} (HR-0001)</option>
                          <optgroup label={`Workspace Employees (${employees.length})`}>
                            {filteredEmployeesList.map(emp => (
                              <option key={emp.id} value={emp.id}>
                                {emp.employeeCode} — {emp.firstName} {emp.lastName} ({emp.department?.name || 'General'})
                              </option>
                            ))}
                          </optgroup>
                        </select>
                      </div>
                    </div>

                    {/* Editable Credentials Card */}
                    <div className="studio-card">
                      <div className="studio-card-title">
                        <span>Badge Identity & Details</span>
                        <span style={{ fontSize: '0.75rem', color: '#22c55e', fontWeight: 600 }}>● Instant Sync</span>
                      </div>

                      <div className="form-grid">
                        <div className="form-group">
                          <label>Full Name</label>
                          <input
                            type="text"
                            value={liveCardData.fullName}
                            onChange={(e) => setLiveCardData(prev => ({ ...prev, fullName: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Designation / Role</label>
                          <input
                            type="text"
                            value={liveCardData.designation}
                            onChange={(e) => setLiveCardData(prev => ({ ...prev, designation: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Employee ID (EMP ID)</label>
                          <input
                            type="text"
                            value={liveCardData.employeeCode}
                            onChange={(e) => setLiveCardData(prev => ({ ...prev, employeeCode: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Phone Number</label>
                          <input
                            type="text"
                            value={liveCardData.phone}
                            onChange={(e) => setLiveCardData(prev => ({ ...prev, phone: e.target.value }))}
                          />
                        </div>

                        <div className="form-group">
                          <label>Blood Group</label>
                          <select
                            value={liveCardData.bloodGroup}
                            onChange={(e) => setLiveCardData(prev => ({ ...prev, bloodGroup: e.target.value }))}
                            style={{
                              width: '100%',
                              padding: '10px 14px',
                              border: '1px solid #cbd5e1',
                              borderRadius: '8px',
                              background: '#f8fafc',
                              fontSize: '0.88rem',
                              color: '#334155',
                              outline: 'none',
                            }}
                          >
                            <option value="N/A">N/A</option>
                            <option value="O+">O+</option>
                            <option value="O-">O-</option>
                            <option value="A+">A+</option>
                            <option value="A-">A-</option>
                            <option value="B+">B+</option>
                            <option value="B-">B-</option>
                            <option value="AB+">AB+</option>
                            <option value="AB-">AB-</option>
                          </select>
                        </div>
                      </div>
                    </div>

                    {/* Media, Photos & Signatures */}
                    <div className="studio-card">
                      <div className="studio-card-title">
                        <span>Card Media & Signatures</span>
                      </div>

                      <div className="media-controls-grid">
                        {/* Photo Customizer */}
                        <div className="media-box">
                          <div className="media-box-label">Profile Photo</div>
                          <div className="media-box-body">
                            <div className="media-preview-mini">
                              {liveCardData.photo ? (
                                <img src={liveCardData.photo} alt="Photo" />
                              ) : (
                                <div 
                                  className="mini-avatar-initials" 
                                  style={{ 
                                    background: getAvatarBg(liveCardData.fullName),
                                    color: getAvatarTextColor(liveCardData.fullName)
                                  }}
                                >
                                  {getInitials(liveCardData.fullName)}
                                </div>
                              )}
                            </div>
                            <div className="media-box-actions">
                              <label className="btn-mini-upload">
                                <Upload size={13} />
                                <span>Upload Photo</span>
                                <input 
                                  type="file" 
                                  accept="image/png, image/jpeg" 
                                  style={{ display: 'none' }} 
                                  onChange={handleLivePhotoUpload} 
                                />
                              </label>
                              {liveCardData.photo && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-mini-adjust"
                                    onClick={() => {
                                      if (liveCardData.photo) {
                                        setRawCropImage(liveCardData.photo)
                                        measureCropImage(liveCardData.photo)
                                        setCropZoom(1)
                                        setCropPan({ x: 0, y: 0 })
                                        setIsCropModalOpen(true)
                                      }
                                    }}
                                    title="Crop and frame photo"
                                  >
                                    <Crop size={13} />
                                    <span>Crop</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-mini-adjust"
                                    onClick={() => setShowPhotoAdjust(true)}
                                    title="Adjust zoom and position in live preview"
                                  >
                                    <SlidersHorizontal size={13} />
                                    <span>Adjust</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-mini-adjust"
                                    onClick={async () => {
                                      const src = rawPhotoSource || liveCardData.photo
                                      if (!rawPhotoSource && liveCardData.photo) setRawPhotoSource(liveCardData.photo)
                                      if (src) {
                                        const cleaned = await removePhotoBackground(src, photoBgTolerance)
                                        setLiveCardData(prev => ({ ...prev, photo: cleaned }))
                                      }
                                    }}
                                    title="Remove solid/light background from photo"
                                  >
                                    <Sparkles size={13} />
                                    <span>Remove BG</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn-mini-clear"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photo: '' }))}
                                    title="Reset to Initials Avatar"
                                  >
                                    Use Initials
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>

                        {/* Signature Customizer */}
                        <div className="media-box">
                          <div className="media-box-label">Employee Signature</div>
                          <div className="media-box-body">
                            <div className="media-preview-mini sig-box">
                              {liveCardData.signature ? (
                                <img src={liveCardData.signature} alt="Sig" />
                              ) : (
                                <span className="no-sig-text">None</span>
                              )}
                            </div>
                            <div className="media-box-actions">
                              <label className="btn-mini-upload">
                                <Upload size={13} />
                                <span>Upload Sig</span>
                                <input 
                                  type="file" 
                                  accept="image/png, image/jpeg" 
                                  style={{ display: 'none' }} 
                                  onChange={handleLiveSignatureUpload} 
                                />
                              </label>
                              {liveCardData.signature && (
                                <>
                                  <button
                                    type="button"
                                    className="btn-mini-adjust"
                                    onClick={() => setShowSigAdjust(prev => !prev)}
                                    title="Adjust signature zoom, position, and background removal"
                                  >
                                    <SlidersHorizontal size={13} />
                                    <span>Adjust</span>
                                  </button>
                                  <button
                                    type="button"
                                    className="btn-mini-adjust"
                                    onClick={async () => {
                                      const src = rawSigSource || liveCardData.signature
                                      if (!rawSigSource && liveCardData.signature) setRawSigSource(liveCardData.signature)
                                      if (src) {
                                        const cleaned = await removeSignatureBackground(src, sigBgThreshold)
                                        setLiveCardData(prev => ({ ...prev, signature: cleaned }))
                                      }
                                    }}
                                    title="Live remove background from signature"
                                  >
                                    <Sparkles size={13} />
                                    <span>Remove BG</span>
                                  </button>
                                  <button 
                                    type="button" 
                                    className="btn-mini-clear"
                                    onClick={() => {
                                      setRawSigSource(null)
                                      setLiveCardData(prev => ({ ...prev, signature: '', sigScale: 1, sigOffsetX: 0, sigOffsetY: 0, sigRotate: 0 }))
                                    }}
                                  >
                                    Remove
                                  </button>
                                </>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    </div>

                    {/* Action Buttons Toolbar */}
                    <div className="studio-actions-toolbar">
                      <button 
                        type="button" 
                        className="btn-save-primary"
                        onClick={handleSaveLiveCard}
                      >
                        <Save size={16} />
                        <span>Save ID Card Changes</span>
                      </button>

                      <button 
                        type="button" 
                        className="btn-reset-secondary"
                        onClick={handleResetLiveCard}
                        title="Revert customizations back to original database profile"
                      >
                        <RefreshCw size={15} />
                        <span>Reset</span>
                      </button>
                    </div>
                  </div>

                  {/* Right Column: Sticky Live ID Card Preview */}
                  <div className="idcard-preview-panel">
                    <div className="preview-sticky-wrapper">
                      <div className="preview-header-bar">
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span className="live-dot-indicator"></span>
                          <h4>Live ID Card Preview</h4>
                        </div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          {user?.role === 'HR' && (
                            <button
                              type="button"
                              className="btn-toggle-adjust-toolbar"
                              onClick={() => setShowPhotoAdjust(prev => !prev)}
                              style={{
                                display: 'inline-flex',
                                alignItems: 'center',
                                gap: '5px',
                                padding: '4px 10px',
                                borderRadius: '6px',
                                fontSize: '0.75rem',
                                fontWeight: 600,
                                background: showPhotoAdjust ? '#eff6ff' : '#f8fafc',
                                color: showPhotoAdjust ? '#2563eb' : '#475569',
                                border: showPhotoAdjust ? '1.5px solid #bfdbfe' : '1px solid #e2e8f0',
                                cursor: 'pointer',
                                transition: 'all 0.15s ease'
                              }}
                              title="Toggle Photo Adjust Controls"
                            >
                              <SlidersHorizontal size={13} />
                              <span>Photo Adjust</span>
                              {((liveCardData.photoScale && liveCardData.photoScale !== 1) || liveCardData.photoOffsetX || liveCardData.photoOffsetY || liveCardData.photoRotate) ? (
                                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#2563eb' }}></span>
                              ) : null}
                            </button>
                          )}
                          <span className="live-tag">Real-Time Sync</span>
                        </div>
                      </div>

                      {/* Photo Adjust Controls Box (HR Portal Only) */}
                      {user?.role === 'HR' && showPhotoAdjust && (
                        <div className="preview-photo-adjust-box">
                          <div className="adjust-box-header">
                            <div className="adjust-box-title">
                              <SlidersHorizontal size={14} color="#2563eb" />
                              <span>Photo Adjust (Fit & Position)</span>
                            </div>
                            <button
                              type="button"
                              className="btn-adjust-reset"
                              onClick={() => setLiveCardData(prev => ({ ...prev, photoScale: 1, photoOffsetX: 0, photoOffsetY: 0, photoRotate: 0 }))}
                              title="Reset photo position and zoom"
                            >
                              <RefreshCw size={11} />
                              <span>Reset</span>
                            </button>
                          </div>

                          {liveCardData.photo ? (
                            <div className="adjust-controls-container">
                              {/* Zoom Slider & Buttons */}
                              <div className="adjust-control-row">
                                <span className="adjust-label">
                                  <ZoomIn size={12} /> Zoom: <strong>{Math.round((liveCardData.photoScale || 1) * 100)}%</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <button 
                                    type="button" 
                                    className="adjust-step-btn"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photoScale: Math.max(0.15, Math.round(((prev.photoScale || 1) - 0.05) * 100) / 100) }))}
                                    title="Zoom Out"
                                  >
                                    <ZoomOut size={12} />
                                  </button>
                                  <input
                                    type="range"
                                    min="0.15"
                                    max="3.0"
                                    step="0.02"
                                    value={liveCardData.photoScale || 1}
                                    onChange={(e) => setLiveCardData(prev => ({ ...prev, photoScale: parseFloat(e.target.value) }))}
                                    className="adjust-slider"
                                  />
                                  <button 
                                    type="button" 
                                    className="adjust-step-btn"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photoScale: Math.min(3.0, Math.round(((prev.photoScale || 1) + 0.05) * 100) / 100) }))}
                                    title="Zoom In"
                                  >
                                    <ZoomIn size={12} />
                                  </button>
                                </div>
                              </div>

                              {/* Pan X Slider & Buttons */}
                              <div className="adjust-control-row">
                                <span className="adjust-label">
                                  <MoveHorizontal size={12} /> Move Left / Right: <strong>{liveCardData.photoOffsetX || 0}px</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <button 
                                    type="button" 
                                    className="adjust-step-btn"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photoOffsetX: (prev.photoOffsetX || 0) - 4 }))}
                                    title="Move Left"
                                  >
                                    ◀
                                  </button>
                                  <input
                                    type="range"
                                    min="-150"
                                    max="150"
                                    step="1"
                                    value={liveCardData.photoOffsetX || 0}
                                    onChange={(e) => setLiveCardData(prev => ({ ...prev, photoOffsetX: parseInt(e.target.value, 10) }))}
                                    className="adjust-slider"
                                  />
                                  <button 
                                    type="button" 
                                    className="adjust-step-btn"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photoOffsetX: (prev.photoOffsetX || 0) + 4 }))}
                                    title="Move Right"
                                  >
                                    ▶
                                  </button>
                                </div>
                              </div>

                              {/* Pan Y Slider & Buttons */}
                              <div className="adjust-control-row">
                                <span className="adjust-label">
                                  <MoveVertical size={12} /> Move Up / Down: <strong>{liveCardData.photoOffsetY || 0}px</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <button 
                                    type="button" 
                                    className="adjust-step-btn"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photoOffsetY: (prev.photoOffsetY || 0) - 4 }))}
                                    title="Move Up"
                                  >
                                    ▲
                                  </button>
                                  <input
                                    type="range"
                                    min="-150"
                                    max="150"
                                    step="1"
                                    value={liveCardData.photoOffsetY || 0}
                                    onChange={(e) => setLiveCardData(prev => ({ ...prev, photoOffsetY: parseInt(e.target.value, 10) }))}
                                    className="adjust-slider"
                                  />
                                  <button 
                                    type="button" 
                                    className="adjust-step-btn"
                                    onClick={() => setLiveCardData(prev => ({ ...prev, photoOffsetY: (prev.photoOffsetY || 0) + 4 }))}
                                    title="Move Down"
                                  >
                                    ▼
                                  </button>
                                </div>
                              </div>

                              {/* Bottom Actions: Rotate & Hint */}
                              <div className="adjust-bottom-tools">
                                <button
                                  type="button"
                                  className="btn-rotate-adjust"
                                  onClick={() => setLiveCardData(prev => ({ ...prev, photoRotate: ((prev.photoRotate || 0) + 90) % 360 }))}
                                >
                                  <RotateCw size={12} />
                                  <span>Rotate 90° ({liveCardData.photoRotate || 0}°)</span>
                                </button>
                                <span className="adjust-drag-hint">
                                  <Move size={11} /> Drag photo on ID card
                                </span>
                              </div>

                              {/* Live Photo Background Remover Slider */}
                              <div className="adjust-control-row" style={{ marginTop: 8, paddingTop: 8, borderTop: '1px dashed #cbd5e1' }}>
                                <span className="adjust-label">
                                  <Sparkles size={12} /> Live BG Remover: <strong>{photoBgTolerance}</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <input
                                    type="range"
                                    min="15"
                                    max="95"
                                    step="1"
                                    value={photoBgTolerance}
                                    onChange={async (e) => {
                                      const tol = parseInt(e.target.value, 10)
                                      setPhotoBgTolerance(tol)
                                      const src = rawPhotoSource || liveCardData.photo
                                      if (!rawPhotoSource && liveCardData.photo) setRawPhotoSource(liveCardData.photo)
                                      if (src) {
                                        const cleaned = await removePhotoBackground(src, tol)
                                        setLiveCardData(prev => ({ ...prev, photo: cleaned }))
                                      }
                                    }}
                                    className="adjust-slider"
                                  />
                                  {rawPhotoSource && (
                                    <button
                                      type="button"
                                      className="btn-adjust-reset"
                                      onClick={() => setLiveCardData(prev => ({ ...prev, photo: rawPhotoSource }))}
                                      title="Restore original photo"
                                    >
                                      Original
                                    </button>
                                  )}
                                </div>
                              </div>
                            </div>
                          ) : (
                            <div className="adjust-empty-hint">
                              <span>No photo uploaded. Upload a photo or select an employee to adjust framing.</span>
                            </div>
                          )}
                        </div>
                      )}

                      {/* Signature Adjust & Live BG Remover Panel */}
                      {user?.role === 'HR' && showSigAdjust && (
                        <div className="preview-photo-adjust-box" style={{ marginTop: 10 }}>
                          <div className="adjust-box-header">
                            <div className="adjust-box-title">
                              <SlidersHorizontal size={14} color="#7c3aed" />
                              <span>Signature Adjust &amp; Live BG Remover</span>
                            </div>
                            <button
                              type="button"
                              className="btn-adjust-reset"
                              onClick={() => setLiveCardData(prev => ({ ...prev, sigScale: 1, sigOffsetX: 0, sigOffsetY: 0, sigRotate: 0 }))}
                            >
                              <RefreshCw size={11} />
                              <span>Reset</span>
                            </button>
                          </div>

                          {liveCardData.signature ? (
                            <div className="adjust-controls-container">
                              <div className="adjust-control-row">
                                <span className="adjust-label">
                                  <ZoomIn size={12} /> Zoom: <strong>{Math.round((liveCardData.sigScale || 1) * 100)}%</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <button type="button" className="adjust-step-btn" onClick={() => setLiveCardData(prev => ({ ...prev, sigScale: Math.max(0.3, Math.round(((prev.sigScale || 1) - 0.1) * 100) / 100) }))}>
                                    <ZoomOut size={12} />
                                  </button>
                                  <input
                                    type="range" min="0.3" max="3.0" step="0.05"
                                    value={liveCardData.sigScale || 1}
                                    onChange={(e) => setLiveCardData(prev => ({ ...prev, sigScale: parseFloat(e.target.value) }))}
                                    className="adjust-slider"
                                  />
                                  <button type="button" className="adjust-step-btn" onClick={() => setLiveCardData(prev => ({ ...prev, sigScale: Math.min(3.0, Math.round(((prev.sigScale || 1) + 0.1) * 100) / 100) }))}>
                                    <ZoomIn size={12} />
                                  </button>
                                </div>
                              </div>

                              <div className="adjust-control-row">
                                <span className="adjust-label">
                                  <MoveHorizontal size={12} /> Move X: <strong>{liveCardData.sigOffsetX || 0}px</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <input
                                    type="range" min="-60" max="60" step="1"
                                    value={liveCardData.sigOffsetX || 0}
                                    onChange={(e) => setLiveCardData(prev => ({ ...prev, sigOffsetX: parseInt(e.target.value, 10) }))}
                                    className="adjust-slider"
                                  />
                                </div>
                              </div>

                              <div className="adjust-control-row">
                                <span className="adjust-label">
                                  <MoveVertical size={12} /> Move Y: <strong>{liveCardData.sigOffsetY || 0}px</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <input
                                    type="range" min="-40" max="40" step="1"
                                    value={liveCardData.sigOffsetY || 0}
                                    onChange={(e) => setLiveCardData(prev => ({ ...prev, sigOffsetY: parseInt(e.target.value, 10) }))}
                                    className="adjust-slider"
                                  />
                                </div>
                              </div>

                              <div className="adjust-control-row" style={{ paddingTop: 6, borderTop: '1px dashed #cbd5e1' }}>
                                <span className="adjust-label">
                                  <Sparkles size={12} /> Live BG Remover: <strong>{sigBgThreshold}</strong>
                                </span>
                                <div className="adjust-input-group">
                                  <input
                                    type="range" min="130" max="245" step="1"
                                    value={sigBgThreshold}
                                    onChange={async (e) => {
                                      const th = parseInt(e.target.value, 10)
                                      setSigBgThreshold(th)
                                      const src = rawSigSource || liveCardData.signature
                                      if (!rawSigSource && liveCardData.signature) setRawSigSource(liveCardData.signature)
                                      if (src) {
                                        const cleaned = await removeSignatureBackground(src, th)
                                        setLiveCardData(prev => ({ ...prev, signature: cleaned }))
                                      }
                                    }}
                                    className="adjust-slider"
                                  />
                                </div>
                              </div>

                              <div className="adjust-bottom-tools">
                                <button
                                  type="button"
                                  className="btn-rotate-adjust"
                                  onClick={() => setLiveCardData(prev => ({ ...prev, sigRotate: ((prev.sigRotate || 0) + 90) % 360 }))}
                                >
                                  <RotateCw size={12} />
                                  <span>Rotate 90° ({liveCardData.sigRotate || 0}°)</span>
                                </button>
                                <span className="adjust-drag-hint">
                                  <Move size={11} /> Drag signature on ID card
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="adjust-empty-hint">
                              <span>No signature uploaded. Upload a signature to adjust framing or remove background.</span>
                            </div>
                          )}
                        </div>
                      )}

                      <div className="id-card-wrapper">
                        <div id="employee-id-card" className="id-card">
                          {/* Header Image */}
                          <div className="id-header">
                            <a href="https://ibb.co/CK25RNxV" target="_blank" rel="noopener noreferrer">
                              <img 
                                src="https://i.ibb.co/gZVMkHst/Whats-App-Image-2026-05-30-at-11-03-55-AM-1.jpg" 
                                alt="VR Pi GROUP OF COMPANIES" 
                                style={{ width: '100%', height: 'auto', border: 0 }} 
                              />
                            </a>
                          </div>

                          {/* Middle Section: Photo or Stylized Initials Avatar */}
                          <div className="id-photo-container">
                            {liveCardData.photo ? (
                              <div 
                                className="id-photo-frame"
                                onMouseDown={handlePhotoMouseDown}
                                style={{
                                  cursor: user?.role === 'HR' ? 'grab' : 'default',
                                  position: 'relative',
                                  userSelect: 'none'
                                }}
                                title={user?.role === 'HR' ? 'Drag with mouse to adjust photo position' : undefined}
                              >
                                <img 
                                  src={liveCardData.photo} 
                                  alt={liveCardData.fullName}
                                  style={{
                                    position: 'absolute',
                                    top: '50%',
                                    left: '50%',
                                    width: '100%',
                                    height: '100%',
                                    objectFit: 'cover',
                                    transform: `translate(-50%, -50%) translate(${liveCardData.photoOffsetX || 0}px, ${liveCardData.photoOffsetY || 0}px) scale(${liveCardData.photoScale || 1}) rotate(${liveCardData.photoRotate || 0}deg)`,
                                    transformOrigin: 'center center',
                                    pointerEvents: 'none',
                                    display: 'block',
                                    border: 'none',
                                    borderRadius: 0,
                                    outline: 'none',
                                    boxShadow: 'none',
                                    transition: isDraggingPhoto ? 'none' : 'transform 0.08s ease-out'
                                  }}
                                  draggable={false}
                                />
                                {user?.role === 'HR' && !isDraggingPhoto && (
                                  <div className="id-photo-badge-hint" data-html2canvas-ignore="true">
                                    <Move size={10} />
                                    <span>Drag</span>
                                  </div>
                                )}
                              </div>
                            ) : (
                              <div 
                                className="id-avatar-placeholder"
                                style={{ 
                                  backgroundColor: getAvatarBg(liveCardData.fullName),
                                  color: getAvatarTextColor(liveCardData.fullName)
                                }}
                              >
                                {getInitials(liveCardData.fullName)}
                              </div>
                            )}
                          </div>
                          
                          {/* Live Name & Designation */}
                          <div className="id-details">
                            <div className="id-name">{(liveCardData.fullName || 'EMPLOYEE NAME').toUpperCase()}</div>
                            <div className="id-designation">{(liveCardData.designation || 'EMPLOYEE').toUpperCase()}</div>
                            
                            <div className="id-info-grid">
                              <div className="id-info-row">
                                <span className="id-label">EMP ID:</span>
                                <span className="id-val">{liveCardData.employeeCode || 'N/A'}</span>
                              </div>
                              <div className="id-info-row">
                                <span className="id-label">Phone No.:</span>
                                <span className="id-val">{liveCardData.phone || 'N/A'}</span>
                              </div>
                              <div className="id-info-row">
                                <span className="id-label">Blood Group:</span>
                                <span className="id-val">{liveCardData.bloodGroup || 'N/A'}</span>
                              </div>
                            </div>
                          </div>

                          {/* Signatures */}
                          <div className="id-signatures-row">
                            <div className="id-signature-col left">
                              <div
                                className="sig-image-container"
                                onMouseDown={handleSigMouseDown}
                                style={{
                                  cursor: user?.role === 'HR' && liveCardData.signature ? 'grab' : 'default',
                                  overflow: 'hidden',
                                  userSelect: 'none',
                                }}
                                title={user?.role === 'HR' && liveCardData.signature ? 'Drag with mouse to adjust signature position' : undefined}
                              >
                                {liveCardData.signature ? (
                                  <img
                                    src={liveCardData.signature}
                                    alt="Employee Signature"
                                    draggable={false}
                                    style={{
                                      transform: `translate(${liveCardData.sigOffsetX || 0}px, ${liveCardData.sigOffsetY || 0}px) scale(${liveCardData.sigScale || 1}) rotate(${liveCardData.sigRotate || 0}deg)`,
                                      transformOrigin: 'center center',
                                      transition: isDraggingSig ? 'none' : 'transform 0.08s ease-out',
                                      pointerEvents: 'none',
                                    }}
                                  />
                                ) : (
                                  <span className="no-sig-placeholder">No Signature</span>
                                )}
                              </div>
                              <div className="sig-label-text">Employee Signature</div>
                            </div>

                            <div className="id-signature-col right">
                              <div className="sig-image-container">
                                {liveCardData.showAuthorizedSig && (
                                  <img src={liveCardData.authorizedSignature || '/authorized_signature.png?v=2'} alt="Authorized Signature" />
                                )}
                              </div>
                              <div className="sig-label-text">Authorized Signature</div>
                            </div>
                          </div>

                          {/* Footer Image */}
                          <div className="id-footer">
                            <a href="https://ibb.co/1YNRQFpP" target="_blank" rel="noopener noreferrer">
                              <img 
                                src="https://i.ibb.co/nqyQmxVY/Whats-App-Image-2026-05-30-at-11-29-15-AM.jpg" 
                                alt="Corporate Address: India & USA" 
                                style={{ width: '100%', display: 'block', border: 0 }} 
                              />
                            </a>
                          </div>
                        </div>
                      </div>

                      {/* Quick Download & Print Toolbar */}
                      <div className="preview-quick-actions">
                        <button type="button" className="btn-primary" onClick={downloadIdCard}>
                          <Download size={16} />
                          <span>Download HD PNG</span>
                        </button>
                        <button type="button" className="btn-secondary" onClick={handlePrintCard}>
                          <Printer size={16} />
                          <span>Print Badge</span>
                        </button>
                      </div>
                    </div>
                  </div>
                </div>
              ) : (
                /* Regular Employee View */
                <div className="id-card-container">
                  <div className="id-card-wrapper">
                    <div id="employee-id-card" className="id-card">
                      <div className="id-header">
                        <a href="https://ibb.co/CK25RNxV">
                          <img 
                            src="https://i.ibb.co/gZVMkHst/Whats-App-Image-2026-05-30-at-11-03-55-AM-1.jpg" 
                            alt="Whats-App-Image-2026-05-30-at-11-03-55-AM-1" 
                            style={{ width: '100%', height: 'auto', border: 0 }} 
                          />
                        </a>
                      </div>
                      <div className="id-photo-container">
                        {employeeDetails?.photo ? (
                          <img src={employeeDetails.photo} alt="Employee" />
                        ) : (
                          <div 
                            className="id-avatar-placeholder"
                            style={{ 
                              backgroundColor: getAvatarBg(fullName),
                              color: getAvatarTextColor(fullName)
                            }}
                          >
                            {getInitials(fullName)}
                          </div>
                        )}
                      </div>
                      
                      <div className="id-details">
                        <div className="id-name">{fullName.toUpperCase()}</div>
                        <div className="id-designation">{employeeDetails?.designation?.title || roleName}</div>
                        
                        <div className="id-info-grid">
                          <div className="id-info-row">
                            <span className="id-label">EMP ID:</span>
                            <span className="id-val">{profile.manualEmployeeId || 'N/A'}</span>
                          </div>
                          <div className="id-info-row">
                            <span className="id-label">Phone No.:</span>
                            <span className="id-val">{profile.phone || (user as any)?.phone || 'N/A'}</span>
                          </div>
                          <div className="id-info-row">
                            <span className="id-label">Blood Group:</span>
                            <span className="id-val">{profile.manualBloodGroup || 'N/A'}</span>
                          </div>
                        </div>
                      </div>

                      <div className="id-signatures-row">
                        <div className="id-signature-col left">
                          <div className="sig-image-container">
                            {employeeDetails?.signature ? (
                              <img src={employeeDetails.signature} alt="Employee Signature" />
                            ) : (
                              <span className="no-sig-placeholder">No Signature</span>
                            )}
                          </div>
                          <div className="sig-label-text">Employee Signature</div>
                        </div>

                        <div className="id-signature-col right">
                          <div className="sig-image-container">
                            <img src="/authorized_signature.png?v=2" alt="Authorized Signature" />
                          </div>
                          <div className="sig-label-text">Authorized Signature</div>
                        </div>
                      </div>

                      <div className="id-footer">
                        <a href="https://ibb.co/1YNRQFpP">
                          <img 
                            src="https://i.ibb.co/nqyQmxVY/Whats-App-Image-2026-05-30-at-11-29-15-AM.jpg" 
                            alt="Corporate Address" 
                            style={{ width: '100%', display: 'block', border: 0 }} 
                          />
                        </a>
                      </div>
                    </div>
                  </div>

                  <div className="id-card-actions">
                    <p className="id-help-text">Please ensure all your personal details are accurate. Download your digital ID card to keep on your mobile device or print a physical copy.</p>
                    <div className="action-buttons-row">
                      {canUploadSignature ? (
                        <label className="btn-secondary" style={{ cursor: 'pointer' }}>
                          <Upload size={16} />
                          <span>
                            {isUploading 
                              ? 'Uploading...' 
                              : signatureUploadsUsed === 0 
                                ? 'Upload Signature (2 left)' 
                                : 'Update Signature (1 left)'}
                          </span>
                          <input 
                            type="file" 
                            accept="image/png, image/jpeg" 
                            style={{ display: 'none' }} 
                            onChange={handleSignatureUpload}
                            disabled={isUploading}
                          />
                        </label>
                      ) : (
                        <button type="button" className="btn-secondary" style={{ cursor: 'not-allowed', opacity: 0.8 }} disabled title="Signature upload limit reached (2/2)">
                          <CheckCircle size={16} color="#10b981" />
                          <span>Signature Uploaded (2/2)</span>
                        </button>
                      )}

                      <button type="button" className="btn-primary" onClick={downloadIdCard}>
                        <Download size={16} />
                        <span>Download ID Card</span>
                      </button>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {activeTab !== 'JOB' && activeTab !== 'IDCARD' && (
            <div className="form-footer-action">
              <button 
                type="submit" 
                className="btn-save" 
                disabled={isSaving || (activeTab === 'BANK' && !canEditBank)}
                style={activeTab === 'BANK' && !canEditBank ? { opacity: 0.6, cursor: 'not-allowed' } : {}}
              >
                <Save size={16} />
                <span>
                  {isSaving 
                    ? 'Saving to Database...' 
                    : (activeTab === 'BANK' && !canEditBank ? 'Banking Coordinates Locked (2/2)' : 'Save Profile Changes')}
                </span>
              </button>
            </div>
          )}
        </form>

        {/* Interactive Photo Crop Modal */}
        {isCropModalOpen && rawCropImage && (
          <div className="crop-modal-overlay" onClick={() => setIsCropModalOpen(false)}>
            <div className="crop-modal-card" onClick={(e) => e.stopPropagation()}>
              <div className="crop-modal-header">
                <div className="crop-modal-title">
                  <Crop size={18} color="#2563eb" />
                  <span>Crop & Position Photo</span>
                </div>
                <button
                  type="button"
                  className="crop-modal-close"
                  onClick={() => {
                    setIsCropModalOpen(false)
                    setRawCropImage(null)
                  }}
                >
                  <X size={18} />
                </button>
              </div>

              <div className="crop-modal-body">
                <p className="crop-modal-instruction">
                  Drag the photo to center the face, adjust zoom with the slider, and click <strong>Crop & Apply</strong>.
                </p>

                {/* Viewport Box */}
                <div 
                  className="crop-viewport"
                  onMouseDown={handleCropMouseDown}
                  onWheel={handleCropWheel}
                  style={{ cursor: isPanningCrop ? 'grabbing' : 'grab' }}
                  title="Drag to position photo / Scroll to zoom"
                >
                  <img
                    src={rawCropImage}
                    alt="Crop Preview"
                    style={{
                      position: 'absolute',
                      top: '50%',
                      left: '50%',
                      width: cropImgMeta.aspect > 1 ? `${280 * cropImgMeta.aspect}px` : '280px',
                      height: cropImgMeta.aspect > 1 ? '280px' : `${280 / cropImgMeta.aspect}px`,
                      maxWidth: 'none',
                      maxHeight: 'none',
                      transform: `translate(-50%, -50%) translate(${cropPan.x}px, ${cropPan.y}px) scale(${cropZoom})`,
                      transformOrigin: 'center center',
                      userSelect: 'none',
                      pointerEvents: 'none',
                      display: 'block'
                    }}
                    draggable={false}
                  />
                  {/* Badge Frame Silhouette / Guide */}
                  <div className="crop-frame-guide"></div>
                </div>

                {/* Zoom & Reset Toolbar */}
                <div className="crop-controls-strip">
                  <div className="crop-zoom-control">
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '4px' }}>
                      <span className="crop-zoom-label">
                        <ZoomIn size={14} /> Zoom: <strong>{Math.round(cropZoom * 100)}%</strong>
                      </span>
                      <div style={{ display: 'flex', gap: '5px' }}>
                        <button
                          type="button"
                          className="crop-preset-btn"
                          onClick={() => setCropZoom(0.15)}
                          title="Max zoom out to 15%"
                        >
                          Max Out (15%)
                        </button>
                        <button
                          type="button"
                          className="crop-preset-btn"
                          onClick={() => setCropZoom(0.3)}
                          title="Zoom to 30%"
                        >
                          30%
                        </button>
                        <button
                          type="button"
                          className="crop-preset-btn"
                          onClick={() => setCropZoom(0.5)}
                          title="Zoom to 50%"
                        >
                          50%
                        </button>
                        <button
                          type="button"
                          className="crop-preset-btn"
                          onClick={() => setCropZoom(1)}
                          title="Fit to frame (100%)"
                        >
                          100% (Fit)
                        </button>
                      </div>
                    </div>
                    <div className="crop-slider-row">
                      <button
                        type="button"
                        className="crop-step-btn"
                        onClick={() => setCropZoom(prev => Math.max(0.1, Math.round((prev - 0.05) * 100) / 100))}
                        title="Zoom Out"
                      >
                        <ZoomOut size={13} />
                      </button>
                      <input
                        type="range"
                        min="0.10"
                        max="3.5"
                        step="0.01"
                        value={cropZoom}
                        onChange={(e) => setCropZoom(parseFloat(e.target.value))}
                        className="crop-range-slider"
                      />
                      <button
                        type="button"
                        className="crop-step-btn"
                        onClick={() => setCropZoom(prev => Math.min(3.5, Math.round((prev + 0.05) * 100) / 100))}
                        title="Zoom In"
                      >
                        <ZoomIn size={13} />
                      </button>
                    </div>
                  </div>

                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '10px' }}>
                    <button
                      type="button"
                      className="crop-reset-btn"
                      onClick={() => {
                        setCropZoom(0.15)
                        setCropPan({ x: 0, y: 0 })
                      }}
                      title="Max zoom out and center"
                    >
                      <ZoomOut size={12} />
                      <span>Max Zoom Out (15%)</span>
                    </button>
                    <button
                      type="button"
                      className="crop-reset-btn"
                      onClick={() => {
                        setCropZoom(1)
                        setCropPan({ x: 0, y: 0 })
                      }}
                      title="Fit to frame and center"
                    >
                      <RefreshCw size={12} />
                      <span>Fit & Center (100%)</span>
                    </button>
                  </div>
                </div>
              </div>

              <div className="crop-modal-footer">
                <button
                  type="button"
                  className="crop-btn-cancel"
                  onClick={() => {
                    setIsCropModalOpen(false)
                    setRawCropImage(null)
                  }}
                >
                  Cancel
                </button>
                <button
                  type="button"
                  className="crop-btn-apply"
                  onClick={applyCrop}
                >
                  <Check size={16} />
                  <span>Crop & Apply Photo</span>
                </button>
              </div>
            </div>
          </div>
        )}
      </div>

      <style>{`
        /* Crop Modal Styles */
        .crop-modal-overlay {
          position: fixed;
          inset: 0;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(6px);
          z-index: 9999;
          display: flex;
          align-items: center;
          justify-content: center;
          padding: 16px;
          animation: fadeIn 0.15s ease-out;
        }

        @keyframes fadeIn {
          from { opacity: 0; }
          to { opacity: 1; }
        }

        .crop-modal-card {
          background: #ffffff;
          border-radius: 16px;
          width: 100%;
          max-width: 420px;
          box-shadow: 0 20px 40px -8px rgba(0, 0, 0, 0.3);
          overflow: hidden;
          display: flex;
          flex-direction: column;
          animation: scaleUp 0.2s cubic-bezier(0.16, 1, 0.3, 1);
        }

        @keyframes scaleUp {
          from { transform: scale(0.95); opacity: 0; }
          to { transform: scale(1); opacity: 1; }
        }

        .crop-modal-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          padding: 16px 20px;
          border-bottom: 1px solid #e2e8f0;
        }

        .crop-modal-title {
          display: flex;
          align-items: center;
          gap: 8px;
          font-size: 1.05rem;
          font-weight: 700;
          color: #0f172a;
        }

        .crop-modal-close {
          background: transparent;
          border: none;
          color: #64748b;
          cursor: pointer;
          padding: 4px;
          border-radius: 6px;
          display: flex;
          align-items: center;
          justify-content: center;
          transition: all 0.15s ease;
        }

        .crop-modal-close:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .crop-modal-body {
          padding: 20px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        .crop-modal-instruction {
          margin: 0;
          font-size: 0.8rem;
          color: #475569;
          text-align: center;
          line-height: 1.4;
        }

        .crop-viewport {
          width: 280px;
          height: 280px;
          border-radius: 18px;
          position: relative;
          overflow: hidden;
          background: #0f172a;
          box-shadow: inset 0 0 0 1px rgba(255,255,255,0.1), 0 8px 24px rgba(0,0,0,0.15);
          display: flex;
          align-items: center;
          justify-content: center;
          user-select: none;
        }

        .crop-frame-guide {
          position: absolute;
          inset: 0;
          border: 2px dashed rgba(255, 255, 255, 0.7);
          border-radius: 18px;
          pointer-events: none;
          box-shadow: inset 0 0 0 9999px rgba(0, 0, 0, 0.2);
        }

        .crop-controls-strip {
          width: 100%;
          display: flex;
          flex-direction: column;
          gap: 10px;
        }

        .crop-zoom-control {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .crop-zoom-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.78rem;
          font-weight: 600;
          color: #334155;
        }

        .crop-zoom-label strong {
          color: #2563eb;
          margin-left: auto;
        }

        .crop-slider-row {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .crop-preset-btn {
          padding: 2px 7px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          border-radius: 4px;
          font-size: 0.7rem;
          font-weight: 600;
          color: #1d4ed8;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .crop-preset-btn:hover {
          background: #dbeafe;
          border-color: #93c5fd;
        }

        .crop-step-btn {
          width: 28px;
          height: 28px;
          display: flex;
          align-items: center;
          justify-content: center;
          background: #f8fafc;
          border: 1px solid #cbd5e1;
          border-radius: 6px;
          color: #334155;
          cursor: pointer;
          flex-shrink: 0;
          transition: all 0.15s ease;
        }

        .crop-step-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .crop-range-slider {
          flex: 1;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: #e2e8f0;
          border-radius: 4px;
          outline: none;
          cursor: pointer;
        }

        .crop-range-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 16px;
          height: 16px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.3);
        }

        .crop-reset-btn {
          align-self: center;
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 5px 12px;
          background: #f1f5f9;
          border: 1px solid #e2e8f0;
          border-radius: 6px;
          font-size: 0.75rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .crop-reset-btn:hover {
          background: #e2e8f0;
          color: #0f172a;
        }

        .crop-modal-footer {
          display: flex;
          align-items: center;
          justify-content: flex-end;
          gap: 10px;
          padding: 14px 20px;
          border-top: 1px solid #e2e8f0;
          background: #f8fafc;
        }

        .crop-btn-cancel {
          padding: 8px 16px;
          background: #ffffff;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          font-size: 0.84rem;
          font-weight: 600;
          color: #475569;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .crop-btn-cancel:hover {
          background: #f1f5f9;
          color: #0f172a;
        }

        .crop-btn-apply {
          display: inline-flex;
          align-items: center;
          gap: 6px;
          padding: 8px 18px;
          background: #2563eb;
          border: 1px solid #1d4ed8;
          border-radius: 8px;
          font-size: 0.84rem;
          font-weight: 700;
          color: #ffffff;
          cursor: pointer;
          box-shadow: 0 2px 6px rgba(37, 99, 235, 0.25);
          transition: all 0.15s ease;
        }

        .crop-btn-apply:hover {
          background: #1d4ed8;
          box-shadow: 0 4px 10px rgba(37, 99, 235, 0.35);
        }
        .profile-page {
          padding: 24px 32px;
          max-width: 1200px;
          margin: 0 auto;
          font-family: 'Inter', system-ui, sans-serif;
        }

        .profile-header-banner {
          background: linear-gradient(135deg, #1e293b 0%, #0f172a 100%);
          border-radius: 16px;
          padding: 32px;
          display: flex;
          justify-content: space-between;
          align-items: center;
          color: white;
          margin-bottom: 24px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.05);
        }

        .profile-banner-left {
          display: flex;
          align-items: center;
          gap: 24px;
        }

        .profile-avatar-large img {
          width: 80px;
          height: 80px;
          border-radius: 50%;
          border: 4px solid rgba(255, 255, 255, 0.2);
          object-fit: cover;
        }
        
        .avatar-hover-overlay {
          position: absolute;
          top: 0;
          left: 0;
          width: 80px;
          height: 80px;
          border-radius: 50%;
          background: rgba(0, 0, 0, 0.5);
          display: flex;
          align-items: center;
          justify-content: center;
          opacity: 0;
          transition: opacity 0.2s;
        }

        .profile-avatar-large:hover .avatar-hover-overlay {
          opacity: 1;
        }

        .upload-badge-tag {
          position: absolute;
          bottom: -4px;
          left: 50%;
          transform: translateX(-50%);
          background: #3b82f6;
          color: white;
          font-size: 0.62rem;
          font-weight: 700;
          padding: 2px 7px;
          border-radius: 12px;
          white-space: nowrap;
          box-shadow: 0 2px 5px rgba(0,0,0,0.3);
          border: 1.5px solid rgba(255,255,255,0.6);
        }

        .upload-badge-tag.locked {
          background: #64748b;
        }

        .profile-header-text h2 {
          margin: 0 0 6px 0;
          font-size: 1.6rem;
          font-weight: 800;
          letter-spacing: -0.02em;
        }

        .profile-subtitle {
          display: flex;
          align-items: center;
          gap: 8px;
          margin-bottom: 10px;
        }

        .role-tag {
          font-size: 0.72rem;
          font-weight: 800;
          background: #3b82f6;
          color: white;
          padding: 2px 8px;
          border-radius: 4px;
          text-transform: uppercase;
        }

        .dept-tag {
          font-size: 0.8rem;
          color: #94a3b8;
          font-weight: 500;
        }

        .bullet { color: #475569; }

        .email-line {
          margin: 0;
          font-size: 0.82rem;
          color: #cbd5e1;
          display: flex;
          align-items: center;
          gap: 6px;
        }

        .profile-completeness {
          display: flex;
          flex-direction: column;
          align-items: flex-end;
          gap: 8px;
        }

        .profile-completeness span {
          font-size: 0.75rem;
          color: #94a3b8;
          font-weight: 600;
        }

        .progress-bar-container {
          display: flex;
          align-items: center;
          gap: 12px;
          width: 200px;
        }

        .progress-bar {
          height: 8px;
          background: #22c55e;
          border-radius: 4px;
          position: relative;
        }

        .progress-bar-container::before {
          content: '';
          position: absolute;
          width: 200px;
          height: 8px;
          background: rgba(255,255,255,0.1);
          border-radius: 4px;
          z-index: 0;
        }

        .progress-bar { z-index: 1; }
        .progress-val { font-size: 0.8rem; font-weight: 700; color: #22c55e; }

        .profile-tabs {
          display: flex;
          gap: 12px;
          margin-bottom: 24px;
          border-bottom: 1px solid #e2e8f0;
          padding-bottom: 12px;
        }

        .tab-btn {
          background: none;
          border: none;
          padding: 8px 16px;
          font-size: 0.88rem;
          font-weight: 600;
          color: #64748b;
          cursor: pointer;
          border-radius: 8px;
          display: flex;
          align-items: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .tab-btn:hover { background: #f1f5f9; color: #334155; }
        
        .tab-btn.active {
          background: #eff6ff;
          color: #2563eb;
          font-weight: 700;
        }

        .profile-card {
          background: white;
          border: 1px solid #f1f5f9;
          border-radius: 12px;
          padding: 32px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.01);
        }

        .tab-pane h3 {
          margin: 0 0 20px 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: #0f172a;
        }

        .section-divider {
          margin-top: 32px !important;
          border-top: 1px solid #f1f5f9;
          padding-top: 24px;
        }

        .form-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 20px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 6px;
        }

        .form-group label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
        }

        .form-group input {
          width: 100%;
          padding: 10px 14px;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          background: #f8fafc;
          font-size: 0.88rem;
          color: #334155;
          outline: none;
          transition: all 0.2s;
        }

        .form-group input:focus {
          border-color: #3b82f6;
          background: white;
          box-shadow: 0 0 0 3px rgba(59,130,246,0.1);
        }

        .input-with-icon { position: relative; }
        .input-icon { position: absolute; left: 12px; top: 50%; transform: translateY(-50%); color: #64748b; }
        .input-with-icon input { padding-left: 38px; }

        .readonly input {
          background: #f1f5f9;
          border-color: #e2e8f0;
          color: #64748b;
          cursor: not-allowed;
        }

        .readonly-alert {
          margin-top: 24px;
          padding: 12px 16px;
          background: #fff7ed;
          border: 1px solid #ffedd5;
          border-radius: 8px;
          color: #c2410c;
          font-size: 0.8rem;
          display: flex;
          align-items: center;
          gap: 10px;
          font-weight: 600;
        }

        .form-footer-action {
          margin-top: 32px;
          border-top: 1px solid #f1f5f9;
          padding-top: 24px;
          display: flex;
          justify-content: flex-end;
        }

        .btn-save {
          background: #3b82f6;
          color: white;
          border: none;
          padding: 12px 24px;
          border-radius: 8px;
          font-size: 0.88rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(59, 130, 246, 0.2);
          transition: all 0.2s;
        }

        .btn-save:hover { background: #2563eb; transform: translateY(-1px); }

        .success-toast {
          background: #ecfdf5;
          border: 1px solid #a7f3d0;
          color: #065f46;
          padding: 12px 20px;
          border-radius: 8px;
          margin-bottom: 24px;
          display: flex;
          align-items: center;
          gap: 10px;
          font-size: 0.88rem;
          font-weight: 600;
          animation: toastSlide 0.25s ease-out;
        }

        @keyframes toastSlide {
          from { transform: translateY(-10px); opacity: 0; }
          to { transform: translateY(0); opacity: 1; }
        }

        /* HR ID Card Studio Layout & Controls */
        .idcard-studio-layout {
          display: grid;
          grid-template-columns: minmax(0, 1.25fr) minmax(350px, 0.75fr);
          gap: 32px;
          align-items: flex-start;
          margin-top: 8px;
        }

        @media (max-width: 1080px) {
          .idcard-studio-layout {
            grid-template-columns: 1fr;
          }
        }

        .idcard-controls-panel {
          display: flex;
          flex-direction: column;
          gap: 20px;
        }

        .studio-banner {
          background: linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%);
          border: 1px solid #e0e7ff;
          border-radius: 12px;
          padding: 18px 20px;
        }

        .studio-banner-title {
          display: flex;
          align-items: center;
          gap: 10px;
          margin-bottom: 6px;
        }

        .studio-banner-title h3 {
          margin: 0;
          font-size: 1.05rem;
          font-weight: 800;
          color: #1e1b4b;
        }

        .studio-superpower-badge {
          background: #fef3c7;
          color: #b45309;
          font-size: 0.72rem;
          font-weight: 800;
          padding: 2px 8px;
          border-radius: 100px;
          border: 1px solid #fde68a;
        }

        .studio-banner p {
          margin: 0;
          font-size: 0.84rem;
          color: #475569;
          line-height: 1.5;
        }

        .studio-card {
          background: white;
          border: 1px solid #e2e8f0;
          border-radius: 12px;
          padding: 22px;
          box-shadow: 0 2px 8px rgba(0,0,0,0.02);
        }

        .studio-card-title {
          font-size: 0.92rem;
          font-weight: 700;
          color: #0f172a;
          margin: 0 0 16px 0;
          display: flex;
          align-items: center;
          justify-content: space-between;
        }

        .badge-count {
          background: #f1f5f9;
          color: #475569;
          font-size: 0.75rem;
          font-weight: 700;
          padding: 3px 8px;
          border-radius: 6px;
        }

        .media-controls-grid {
          display: grid;
          grid-template-columns: 1fr 1fr;
          gap: 16px;
        }

        .media-box {
          border: 1px solid #e2e8f0;
          border-radius: 10px;
          padding: 14px;
          background: #f8fafc;
        }

        .media-box-label {
          font-size: 0.75rem;
          font-weight: 700;
          color: #64748b;
          text-transform: uppercase;
          letter-spacing: 0.05em;
          margin-bottom: 10px;
        }

        .media-box-body {
          display: flex;
          align-items: center;
          gap: 12px;
        }

        .media-preview-mini {
          width: 52px;
          height: 52px;
          border-radius: 8px;
          overflow: hidden;
          background: white;
          border: 1px solid #cbd5e1;
          display: flex;
          align-items: center;
          justify-content: center;
          flex-shrink: 0;
        }

        .media-preview-mini img {
          width: 100%;
          height: 100%;
          object-fit: cover;
        }

        .media-preview-mini.sig-box img {
          object-fit: contain;
          padding: 4px;
        }

        .mini-avatar-initials {
          width: 100%;
          height: 100%;
          display: flex;
          align-items: center;
          justify-content: center;
          font-weight: 800;
          font-size: 18px;
        }

        .no-sig-text {
          font-size: 0.72rem;
          color: #94a3b8;
          font-weight: 600;
        }

        .media-box-actions {
          display: flex;
          flex-direction: column;
          gap: 6px;
          flex: 1;
        }

        .btn-mini-upload {
          background: #2563eb;
          color: white;
          border-radius: 6px;
          padding: 6px 12px;
          font-size: 0.78rem;
          font-weight: 600;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 6px;
          cursor: pointer;
          transition: background 0.2s;
        }

        .btn-mini-upload:hover { background: #1d4ed8; }

        .btn-mini-clear {
          background: none;
          border: 1px solid #cbd5e1;
          color: #64748b;
          border-radius: 6px;
          padding: 4px 8px;
          font-size: 0.72rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s;
        }

        .btn-mini-clear:hover { background: #fee2e2; color: #dc2626; border-color: #fca5a5; }

        .studio-actions-toolbar {
          display: flex;
          gap: 12px;
          align-items: center;
          padding-top: 8px;
        }

        .btn-save-primary {
          background: linear-gradient(135deg, #2563eb 0%, #1d4ed8 100%);
          color: white;
          border: none;
          border-radius: 8px;
          padding: 12px 24px;
          font-size: 0.9rem;
          font-weight: 700;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 8px;
          box-shadow: 0 4px 12px rgba(37, 99, 235, 0.25);
          transition: all 0.2s;
        }

        .btn-save-primary:hover {
          transform: translateY(-1px);
          box-shadow: 0 6px 16px rgba(37, 99, 235, 0.35);
        }

        .btn-reset-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
          border-radius: 8px;
          padding: 12px 18px;
          font-size: 0.88rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          gap: 6px;
          transition: all 0.2s;
        }

        .btn-reset-secondary:hover {
          background: #e2e8f0;
          color: #1e293b;
        }

        .preview-sticky-wrapper {
          position: sticky;
          top: 24px;
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 16px;
        }

        /* Photo Adjuster Widget inside ID Card Preview */
        .preview-photo-adjust-box {
          width: 100%;
          max-width: 350px;
          background: #ffffff;
          border: 1.5px solid #e2e8f0;
          border-radius: 12px;
          padding: 12px 14px;
          box-shadow: 0 4px 12px -2px rgba(15, 23, 42, 0.05);
          animation: fadeInDown 0.2s ease-out;
        }

        @keyframes fadeInDown {
          from { opacity: 0; transform: translateY(-6px); }
          to { opacity: 1; transform: translateY(0); }
        }

        .adjust-box-header {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-bottom: 10px;
          padding-bottom: 8px;
          border-bottom: 1px solid #f1f5f9;
        }

        .adjust-box-title {
          display: flex;
          align-items: center;
          gap: 7px;
          font-size: 0.82rem;
          font-weight: 700;
          color: #1e293b;
        }

        .btn-adjust-reset {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 3px 8px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          background: #f8fafc;
          color: #64748b;
          border: 1px solid #e2e8f0;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-adjust-reset:hover {
          background: #fee2e2;
          color: #ef4444;
          border-color: #fca5a5;
        }

        .adjust-controls-container {
          display: flex;
          flex-direction: column;
          gap: 9px;
        }

        .adjust-control-row {
          display: flex;
          flex-direction: column;
          gap: 4px;
        }

        .adjust-label {
          display: flex;
          align-items: center;
          gap: 6px;
          font-size: 0.74rem;
          font-weight: 600;
          color: #475569;
        }

        .adjust-label strong {
          color: #2563eb;
          margin-left: auto;
        }

        .adjust-input-group {
          display: flex;
          align-items: center;
          gap: 8px;
        }

        .adjust-step-btn {
          width: 24px;
          height: 24px;
          display: flex;
          align-items: center;
          justify-content: center;
          border-radius: 6px;
          border: 1px solid #cbd5e1;
          background: #f8fafc;
          color: #334155;
          font-size: 0.75rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.15s ease;
          user-select: none;
          flex-shrink: 0;
        }

        .adjust-step-btn:hover {
          background: #e2e8f0;
          border-color: #94a3b8;
          color: #0f172a;
        }

        .adjust-slider {
          flex: 1;
          height: 6px;
          -webkit-appearance: none;
          appearance: none;
          background: #e2e8f0;
          border-radius: 4px;
          outline: none;
          cursor: pointer;
        }

        .adjust-slider::-webkit-slider-thumb {
          -webkit-appearance: none;
          appearance: none;
          width: 14px;
          height: 14px;
          border-radius: 50%;
          background: #2563eb;
          cursor: pointer;
          border: 2px solid #ffffff;
          box-shadow: 0 1px 3px rgba(0,0,0,0.25);
          transition: transform 0.1s ease;
        }

        .adjust-slider::-webkit-slider-thumb:hover {
          transform: scale(1.15);
        }

        .adjust-bottom-tools {
          display: flex;
          align-items: center;
          justify-content: space-between;
          margin-top: 4px;
          padding-top: 6px;
          border-top: 1px dashed #e2e8f0;
        }

        .btn-rotate-adjust {
          display: inline-flex;
          align-items: center;
          gap: 5px;
          padding: 4px 10px;
          border-radius: 6px;
          font-size: 0.72rem;
          font-weight: 600;
          background: #eff6ff;
          color: #1d4ed8;
          border: 1px solid #bfdbfe;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-rotate-adjust:hover {
          background: #dbeafe;
        }

        .adjust-drag-hint {
          font-size: 0.7rem;
          color: #64748b;
          display: flex;
          align-items: center;
          gap: 4px;
        }

        .adjust-empty-hint {
          padding: 10px;
          text-align: center;
          font-size: 0.75rem;
          color: #94a3b8;
          font-style: italic;
        }

        .btn-mini-adjust {
          display: inline-flex;
          align-items: center;
          gap: 4px;
          padding: 4px 8px;
          background: #eff6ff;
          border: 1px solid #bfdbfe;
          color: #1d4ed8;
          border-radius: 6px;
          font-size: 0.74rem;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.15s ease;
        }

        .btn-mini-adjust:hover {
          background: #dbeafe;
        }

        .id-photo-frame {
          width: 140px;
          height: 140px;
          border-radius: 16px;
          border: 1px solid #222;
          overflow: hidden;
          position: relative;
          background: #ffffff;
          display: flex;
          align-items: center;
          justify-content: center;
        }

        .id-photo-frame img {
          position: absolute;
          top: 50%;
          left: 50%;
          width: 100% !important;
          height: 100% !important;
          object-fit: cover !important;
          border: none !important;
          border-radius: 0 !important;
          outline: none !important;
          box-shadow: none !important;
          background: transparent !important;
          display: block;
          user-select: none;
          -webkit-user-drag: none;
        }

        .id-photo-badge-hint {
          position: absolute;
          bottom: 6px;
          right: 6px;
          background: rgba(15, 23, 42, 0.7);
          backdrop-filter: blur(4px);
          color: #ffffff;
          font-size: 9px;
          font-weight: 600;
          padding: 2px 5px;
          border-radius: 4px;
          display: flex;
          align-items: center;
          gap: 3px;
          pointer-events: none;
          opacity: 0;
          transition: opacity 0.2s ease;
        }

        .id-photo-frame:hover .id-photo-badge-hint {
          opacity: 1;
          background: rgba(37, 99, 235, 0.9);
        }

        .preview-header-bar {
          display: flex;
          align-items: center;
          justify-content: space-between;
          width: 100%;
          max-width: 350px;
          background: #0f172a;
          color: white;
          padding: 10px 16px;
          border-radius: 10px;
          box-shadow: 0 4px 12px rgba(0,0,0,0.12);
        }

        .preview-header-bar h4 {
          margin: 0;
          font-size: 0.88rem;
          font-weight: 700;
          flex: 1;
        }

        .live-dot-indicator {
          width: 9px;
          height: 9px;
          background: #22c55e;
          border-radius: 50%;
          box-shadow: 0 0 0 3px rgba(34, 197, 94, 0.35);
          animation: pulseLive 2s infinite;
        }

        @keyframes pulseLive {
          0% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0.7); }
          70% { transform: scale(1); box-shadow: 0 0 0 6px rgba(34, 197, 94, 0); }
          100% { transform: scale(0.95); box-shadow: 0 0 0 0 rgba(34, 197, 94, 0); }
        }

        .live-tag {
          font-size: 0.7rem;
          background: rgba(34, 197, 94, 0.2);
          color: #4ade80;
          padding: 2px 8px;
          border-radius: 100px;
          font-weight: 700;
          letter-spacing: 0.03em;
        }

        .preview-quick-actions {
          display: flex;
          gap: 12px;
          width: 100%;
          max-width: 350px;
        }

        .preview-quick-actions button {
          flex: 1;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          padding: 10px 14px;
          border-radius: 8px;
          font-size: 0.85rem;
          font-weight: 700;
          cursor: pointer;
          transition: all 0.2s;
        }

        .id-avatar-placeholder {
          width: 140px;
          height: 140px;
          border-radius: 16px;
          display: flex;
          align-items: center;
          justify-content: center;
          font-size: 46px;
          font-weight: 800;
          border: 1px solid #111;
          letter-spacing: 1px;
          box-shadow: inset 0 2px 4px rgba(255,255,255,0.2), 0 4px 10px rgba(0,0,0,0.15);
        }

        .id-card-container {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 24px;
          padding: 24px;
        }

        .id-card-wrapper {
          padding: 20px;
          background: #f8fafc;
          border-radius: 16px;
          border: 1px dashed #cbd5e1;
          display: flex;
          justify-content: center;
        }

        .id-card {
          width: 330px;
          min-height: 520px;
          background: #f4f4f4;
          border-radius: 12px;
          box-shadow: 0 4px 20px rgba(0,0,0,0.15);
          display: flex;
          flex-direction: column;
          overflow: hidden;
          font-family: 'Arial', sans-serif;
          border: 1px solid #ddd;
        }

        .id-header {
          padding: 10px;
          text-align: center;
          width: 100%;
        }

        .id-photo-container {
          display: flex;
          justify-content: center;
          margin-top: 10px;
          z-index: 2;
        }

        .id-photo-container > img {
          width: 140px;
          height: 140px;
          border-radius: 16px;
          object-fit: cover;
          border: 1px solid #222;
          background: white;
        }

        .id-details {
          padding: 10px 20px;
          text-align: center;
          flex-grow: 1;
        }

        .id-name {
          color: #e3000f;
          font-weight: 700;
          font-size: 17px;
          margin-bottom: 2px;
          text-transform: uppercase;
        }

        .id-designation {
          color: #e3000f;
          font-weight: 600;
          font-size: 13px;
          margin-bottom: 20px;
        }

        .id-info-grid {
          display: flex;
          flex-direction: column;
          gap: 6px;
          text-align: left;
          padding: 0 15px 0 45px;
        }

        .id-info-row {
          display: flex;
          font-size: 15px;
        }

        .id-label {
          font-weight: 700;
          width: 125px;
          color: #000;
        }

        .id-val {
          font-weight: 700;
          color: #000;
          flex: 1;
        }

        .id-signatures-row {
          display: flex;
          justify-content: space-between;
          padding: 8px 20px 0;
          position: relative;
          z-index: 2;
          gap: 10px;
        }

        .id-signature-col {
          display: flex;
          flex-direction: column;
          align-items: center;
          width: 48%;
        }

        .id-signature-col.left {
          align-items: flex-start;
          padding-left: 10px;
        }

        .id-signature-col.right {
          align-items: flex-end;
          padding-right: 10px;
        }

        .sig-image-container {
          height: 35px;
          margin-bottom: 2px;
          display: flex;
          align-items: center;
          width: 100%;
        }

        .id-signature-col.left .sig-image-container {
          justify-content: flex-start;
        }

        .id-signature-col.right .sig-image-container {
          justify-content: flex-end;
        }

        .sig-image-container img {
          max-height: 35px;
          max-width: 110px;
          object-fit: contain;
        }

        .no-sig-placeholder {
          font-size: 10px;
          color: #94a3b8;
          font-style: italic;
        }

        .auth-sig-style {
          font-family: 'Dancing Script', 'Brush Script MT', cursive;
          font-size: 16px;
          color: #1e3a8a; /* Blue ink color */
          font-weight: bold;
        }

        .sig-label-text {
          font-size: 9px;
          color: #000;
          font-weight: 700;
        }

        .id-footer {
          width: 100%;
          position: relative;
          margin-top: auto;
        }

        .id-card-actions {
          max-width: 400px;
          text-align: center;
        }

        .id-help-text {
          font-size: 0.9rem;
          color: #64748b;
          margin-bottom: 16px;
          line-height: 1.5;
        }

        .action-buttons-row {
          display: flex;
          justify-content: center;
          gap: 12px;
          flex-wrap: wrap;
        }
        
        .btn-primary, .btn-secondary {
          border: none;
          padding: 10px 20px;
          border-radius: 8px;
          font-size: 0.9rem;
          font-weight: 600;
          cursor: pointer;
          display: flex;
          align-items: center;
          justify-content: center;
          gap: 8px;
          transition: all 0.2s;
        }

        .btn-primary {
          background: #3b82f6;
          color: white;
        }
        .btn-primary:hover { background: #2563eb; }

        .btn-secondary {
          background: #f1f5f9;
          color: #475569;
          border: 1px solid #cbd5e1;
        }
        .btn-secondary:hover { background: #e2e8f0; color: #334155; }
      `}</style>
    </div>
  )
}
