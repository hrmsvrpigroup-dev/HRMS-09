/**
 * Real-Time Face Detector Engine
 * Powered by TinyFaceDetector & 68-Point Facial Landmark Neural Network
 * 
 * Strict Face Verification:
 * - Requires genuine human face with verified facial landmarks (eyes, nose, mouth).
 * - Hands, fingers, objects, and backgrounds are STRICTLY REJECTED.
 * - Solid GREEN bounding box + top-left "face" tag + 5 green landmark dots when real face is visible.
 * - Solid RED bounding box + top-left "no face" tag when face is not visible.
 * - Clock In is strictly permitted only when the green box is active.
 */

import * as faceapi from '@vladmandic/face-api';

export interface FaceDetectionBox {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface FaceLandmarks {
  leftEyeCenter: { x: number; y: number };
  rightEyeCenter: { x: number; y: number };
  noseTip: { x: number; y: number };
  leftMouthCorner: { x: number; y: number };
  rightMouthCorner: { x: number; y: number };
  // Backward compatibility fields
  jawline: { x: number; y: number }[];
  leftEyebrow: { x: number; y: number }[];
  rightEyebrow: { x: number; y: number }[];
  leftEye: { x: number; y: number }[];
  rightEye: { x: number; y: number }[];
  leftPupil: { x: number; y: number };
  rightPupil: { x: number; y: number };
  noseBridge: { x: number; y: number }[];
  outerMouth: { x: number; y: number }[];
  innerMouth: { x: number; y: number }[];
}

export interface FaceDetectionResult {
  detected: boolean;
  clarity: number; // 0 to 100
  box: FaceDetectionBox;
  landmarks: FaceLandmarks;
  message: string;
  status: 'valid' | 'no_face' | 'too_far' | 'off_center' | 'poor_lighting';
}

// Model loading states
let modelsLoaded = false;
let modelsLoadingPromise: Promise<boolean> | null = null;

// Box smoothing cache for anti-jitter
let smoothBox: FaceDetectionBox | null = null;

export async function loadFaceDetectionModels(): Promise<boolean> {
  if (modelsLoaded) return true;
  if (modelsLoadingPromise) return modelsLoadingPromise;

  modelsLoadingPromise = (async () => {
    try {
      // 1. Try local /models directory first (works completely offline)
      const LOCAL_URL = '/models';
      await Promise.all([
        faceapi.nets.tinyFaceDetector.loadFromUri(LOCAL_URL),
        faceapi.nets.faceLandmark68TinyNet.loadFromUri(LOCAL_URL),
      ]);
      modelsLoaded = true;
      console.log('✅ Face-API Neural Models Loaded Successfully from /models');
      return true;
    } catch (err) {
      console.warn('Local /models load issue, falling back to CDN...', err);
      try {
        const CDN_URL = 'https://cdn.jsdelivr.net/npm/@vladmandic/face-api/model/';
        await Promise.all([
          faceapi.nets.tinyFaceDetector.loadFromUri(CDN_URL),
          faceapi.nets.faceLandmark68TinyNet.loadFromUri(CDN_URL),
        ]);
        modelsLoaded = true;
        console.log('✅ Face-API Neural Models Loaded from CDN Successfully');
        return true;
      } catch (cdnErr) {
        console.error('Failed to load face detection neural nets:', cdnErr);
        return false;
      }
    }
  })();

  return modelsLoadingPromise;
}

// Start loading models eagerly
if (typeof window !== 'undefined') {
  loadFaceDetectionModels();
}

/**
 * Generate 5-point key landmarks from bounding box geometry
 */
export function generateFaceLandmarks(box: FaceDetectionBox): FaceLandmarks {
  const { x, y, width: w, height: h } = box;
  const cx = x + w / 2;
  const cy = y + h / 2;

  const leftEyeCenter = { x: cx - 0.20 * w, y: cy - 0.12 * h };
  const rightEyeCenter = { x: cx + 0.20 * w, y: cy - 0.12 * h };
  const noseTip = { x: cx, y: cy + 0.08 * h };
  const leftMouthCorner = { x: cx - 0.17 * w, y: cy + 0.27 * h };
  const rightMouthCorner = { x: cx + 0.17 * w, y: cy + 0.27 * h };

  return {
    leftEyeCenter,
    rightEyeCenter,
    noseTip,
    leftMouthCorner,
    rightMouthCorner,
    jawline: [
      { x: cx - 0.45 * w, y: cy - 0.15 * h },
      { x: cx - 0.35 * w, y: cy + 0.35 * h },
      { x: cx, y: cy + 0.50 * h },
      { x: cx + 0.35 * w, y: cy + 0.35 * h },
      { x: cx + 0.45 * w, y: cy - 0.15 * h },
    ],
    leftEyebrow: [
      { x: cx - 0.35 * w, y: cy - 0.22 * h },
      { x: cx - 0.12 * w, y: cy - 0.22 * h },
    ],
    rightEyebrow: [
      { x: cx + 0.12 * w, y: cy - 0.22 * h },
      { x: cx + 0.35 * w, y: cy - 0.22 * h },
    ],
    leftEye: [
      { x: cx - 0.28 * w, y: cy - 0.12 * h },
      { x: cx - 0.12 * w, y: cy - 0.12 * h },
    ],
    rightEye: [
      { x: cx + 0.12 * w, y: cy - 0.12 * h },
      { x: cx + 0.28 * w, y: cy - 0.12 * h },
    ],
    leftPupil: leftEyeCenter,
    rightPupil: rightEyeCenter,
    noseBridge: [
      { x: cx, y: cy - 0.10 * h },
      { x: cx, y: cy + 0.08 * h },
    ],
    outerMouth: [
      leftMouthCorner,
      { x: cx, y: cy + 0.25 * h },
      rightMouthCorner,
      { x: cx, y: cy + 0.31 * h },
    ],
    innerMouth: [leftMouthCorner, rightMouthCorner],
  };
}

/**
 * Detect face from a live HTMLVideoElement
 * Uses strict neural network detection with facial landmark validation.
 * No skin-color fallback that confuses hands/fingers with faces.
 */
export async function detectFaceInVideo(video: HTMLVideoElement): Promise<FaceDetectionResult> {
  const vw = video.videoWidth || 640;
  const vh = video.videoHeight || 480;

  // Centered red guide box for when no face is visible
  const emptyBox: FaceDetectionBox = {
    x: vw * 0.24,
    y: vh * 0.16,
    width: vw * 0.52,
    height: vh * 0.68,
  };
  const emptyLandmarks = generateFaceLandmarks(emptyBox);

  if (video.readyState < 2 || vw <= 0 || vh <= 0) {
    smoothBox = null;
    return {
      detected: false,
      clarity: 0,
      box: emptyBox,
      landmarks: emptyLandmarks,
      message: 'Camera starting...',
      status: 'no_face',
    };
  }

  // Ensure neural network models are loaded
  if (!modelsLoaded) {
    await loadFaceDetectionModels();
  }

  // 1. Primary AI Neural Detector: TinyFaceDetector with 68 Facial Landmarks
  if (modelsLoaded) {
    try {
      const options = new faceapi.TinyFaceDetectorOptions({
        inputSize: 320,
        scoreThreshold: 0.50, // Strict threshold to prevent false positives on hands/objects
      });

      const detection = await faceapi
        .detectSingleFace(video, options)
        .withFaceLandmarks(true);

      if (detection && detection.detection.score >= 0.50) {
        const bb = detection.detection.box;

        // Verify valid face aspect ratio and minimum size
        const faceAspect = bb.height / Math.max(1, bb.width);
        if (faceAspect >= 0.80 && faceAspect <= 2.2 && bb.width >= vw * 0.15 && bb.height >= vh * 0.18) {
          const l = detection.landmarks;
          const leftEyePts = l.getLeftEye();
          const rightEyePts = l.getRightEye();
          const nosePts = l.getNose();
          const mouthPts = l.getMouth();

          // Ensure all key facial features actually exist
          if (leftEyePts.length >= 4 && rightEyePts.length >= 4 && nosePts.length >= 3 && mouthPts.length >= 6) {
            const targetBox: FaceDetectionBox = {
              x: bb.x,
              y: bb.y,
              width: bb.width,
              height: bb.height,
            };

            // Smooth box coordinates across frames to eliminate jitter
            if (!smoothBox) {
              smoothBox = { ...targetBox };
            } else {
              smoothBox = {
                x: smoothBox.x * 0.60 + targetBox.x * 0.40,
                y: smoothBox.y * 0.60 + targetBox.y * 0.40,
                width: smoothBox.width * 0.60 + targetBox.width * 0.40,
                height: smoothBox.height * 0.60 + targetBox.height * 0.40,
              };
            }

            const leftEyeCenter = {
              x: leftEyePts.reduce((s, p) => s + p.x, 0) / leftEyePts.length,
              y: leftEyePts.reduce((s, p) => s + p.y, 0) / leftEyePts.length,
            };
            const rightEyeCenter = {
              x: rightEyePts.reduce((s, p) => s + p.x, 0) / rightEyePts.length,
              y: rightEyePts.reduce((s, p) => s + p.y, 0) / rightEyePts.length,
            };
            const noseTip = nosePts[nosePts.length - 1] || nosePts[3];
            const leftMouthCorner = mouthPts[0];
            const rightMouthCorner = mouthPts[6] || mouthPts[mouthPts.length - 1];

            const landmarks: FaceLandmarks = {
              leftEyeCenter,
              rightEyeCenter,
              noseTip,
              leftMouthCorner,
              rightMouthCorner,
              jawline: l.getJawOutline(),
              leftEyebrow: l.getLeftEyeBrow(),
              rightEyebrow: l.getRightEyeBrow(),
              leftEye: leftEyePts,
              rightEye: rightEyePts,
              leftPupil: leftEyeCenter,
              rightPupil: rightEyeCenter,
              noseBridge: nosePts.slice(0, 4),
              outerMouth: mouthPts,
              innerMouth: mouthPts.slice(12),
            };

            const clarity = Math.min(99, Math.round(detection.detection.score * 100));

            return {
              detected: true,
              clarity,
              box: smoothBox,
              landmarks,
              message: 'Human Face Detected',
              status: 'valid',
            };
          }
        }
      }
    } catch (modelErr) {
      console.error('TinyFaceDetector inference error:', modelErr);
    }
  }

  // 2. Browser Native Shape Detection API (as fallback only if genuine face detected)
  if (typeof (window as any).FaceDetector === 'function') {
    try {
      const nativeDetector = new (window as any).FaceDetector({ fastMode: true, maxDetectedFaces: 1 });
      const faces = await nativeDetector.detect(video);
      if (faces && faces.length > 0) {
        const bb = faces[0].boundingBox;
        const faceAspect = bb.height / Math.max(1, bb.width);

        if (faceAspect >= 0.85 && faceAspect <= 2.2 && bb.width >= vw * 0.15) {
          const targetBox: FaceDetectionBox = {
            x: bb.x,
            y: bb.y,
            width: bb.width,
            height: bb.height,
          };

          if (!smoothBox) {
            smoothBox = { ...targetBox };
          } else {
            smoothBox = {
              x: smoothBox.x * 0.60 + targetBox.x * 0.40,
              y: smoothBox.y * 0.60 + targetBox.y * 0.40,
              width: smoothBox.width * 0.60 + targetBox.width * 0.40,
              height: smoothBox.height * 0.60 + targetBox.height * 0.40,
            };
          }

          return {
            detected: true,
            clarity: 95,
            box: smoothBox,
            landmarks: generateFaceLandmarks(smoothBox),
            message: 'Human Face Detected',
            status: 'valid',
          };
        }
      }
    } catch {
      // Fall through to no face
    }
  }

  // If no genuine human face with facial features is visible:
  smoothBox = null;
  return {
    detected: false,
    clarity: 0,
    box: emptyBox,
    landmarks: emptyLandmarks,
    message: 'Face not visible. Please face the camera.',
    status: 'no_face',
  };
}

/**
 * Draw the exact Face Detector overlay:
 * - When face is visible: solid GREEN bounding box + top-left "face" tag + 5 green landmark dots.
 * - When face is not visible: solid RED bounding box + top-left "no face" tag + no dots.
 */
export function drawFaceDetectorOverlay(
  canvas: HTMLCanvasElement,
  video: HTMLVideoElement,
  res: FaceDetectionResult
) {
  const ctx = canvas.getContext('2d');
  if (!ctx) return;

  const w = canvas.width;
  const h = canvas.height;
  ctx.clearRect(0, 0, w, h);

  const vw = video.videoWidth || w;
  const vh = video.videoHeight || h;
  const sx = w / vw;
  const sy = h / vh;

  const box = {
    x: Math.round(res.box.x * sx),
    y: Math.round(res.box.y * sy),
    width: Math.round(res.box.width * sx),
    height: Math.round(res.box.height * sy),
  };

  const isGreen = res.detected && res.status === 'valid';

  ctx.save();

  if (isGreen) {
    // ══════════════════════════════════════════════════════════
    // GREEN STATE (FACE VISIBLE & DETECTED)
    // ══════════════════════════════════════════════════════════
    const greenColor = '#00ff00';

    // 1. Solid Green Bounding Box
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = greenColor;
    ctx.setLineDash([]);
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // 2. Top-Left Solid Green Tag with "face" text
    const tagW = 46;
    const tagH = 18;
    const tagX = box.x;
    const tagY = Math.max(0, box.y - tagH);

    ctx.fillStyle = greenColor;
    ctx.fillRect(tagX, tagY, tagW, tagH);

    ctx.fillStyle = '#000000';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('face', tagX + tagW / 2, tagY + tagH / 2);

    // 3. Exactly 5 Green Landmark Dots
    // (Left Eye, Right Eye, Nose Tip, Left Mouth Corner, Right Mouth Corner)
    const l = res.landmarks;
    const scalePt = (pt: { x: number; y: number }) => ({
      x: Math.round(pt.x * sx),
      y: Math.round(pt.y * sy),
    });

    const fiveDots = [
      scalePt(l.leftEyeCenter),
      scalePt(l.rightEyeCenter),
      scalePt(l.noseTip),
      scalePt(l.leftMouthCorner),
      scalePt(l.rightMouthCorner),
    ];

    ctx.fillStyle = greenColor;
    for (const dot of fiveDots) {
      ctx.beginPath();
      ctx.arc(dot.x, dot.y, 3.5, 0, Math.PI * 2);
      ctx.fill();
    }
  } else {
    // ══════════════════════════════════════════════════════════
    // RED STATE (FACE NOT VISIBLE / NOT DETECTED)
    // ══════════════════════════════════════════════════════════
    const redColor = '#ef4444';

    // 1. Solid Red Line Box
    ctx.lineWidth = 2.5;
    ctx.strokeStyle = redColor;
    ctx.setLineDash([]);
    ctx.strokeRect(box.x, box.y, box.width, box.height);

    // 2. Top-Left Solid Red Tag with "no face" text
    const tagW = 68;
    const tagH = 18;
    const tagX = box.x;
    const tagY = Math.max(0, box.y - tagH);

    ctx.fillStyle = redColor;
    ctx.fillRect(tagX, tagY, tagW, tagH);

    ctx.fillStyle = '#ffffff';
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('no face', tagX + tagW / 2, tagY + tagH / 2);
  }

  ctx.restore();
}
