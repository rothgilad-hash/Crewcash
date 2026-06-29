import { useRef, useState, useEffect } from 'react'
import Modal from './Modal'

export default function SignaturePad({ open, onClose, onSave, personName, amount, lang }) {
  const canvasRef = useRef(null)
  const [drawing, setDrawing] = useState(false)
  const [empty, setEmpty] = useState(true)
  const isHe = lang === 'he'

  useEffect(() => {
    if (!open) return
    setEmpty(true)
    const canvas = canvasRef.current
    if (!canvas) return
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
  }, [open])

  const getPos = (e, canvas) => {
    const rect = canvas.getBoundingClientRect()
    const scaleX = canvas.width / rect.width
    const scaleY = canvas.height / rect.height
    const src = e.touches ? e.touches[0] : e
    return {
      x: (src.clientX - rect.left) * scaleX,
      y: (src.clientY - rect.top) * scaleY,
    }
  }

  const startDraw = (e) => {
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    const pos = getPos(e, canvas)
    ctx.beginPath()
    ctx.moveTo(pos.x, pos.y)
    setDrawing(true)
    setEmpty(false)
  }

  const draw = (e) => {
    if (!drawing) return
    e.preventDefault()
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.lineWidth = 2.5
    ctx.lineCap = 'round'
    ctx.lineJoin = 'round'
    ctx.strokeStyle = '#1e3a5f'
    const pos = getPos(e, canvas)
    ctx.lineTo(pos.x, pos.y)
    ctx.stroke()
  }

  const endDraw = (e) => {
    e.preventDefault()
    setDrawing(false)
  }

  const clear = () => {
    const canvas = canvasRef.current
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    setEmpty(true)
  }

  const save = () => {
    const canvas = canvasRef.current
    const dataUrl = canvas.toDataURL('image/png')
    onSave(dataUrl)
  }

  return (
    <Modal open={open} onClose={onClose} title={isHe ? 'חתימה על קבלת כסף' : 'Sign for Cash Receipt'}>
      <div className="space-y-4">
        <p className="text-sm text-gray-500 text-center">
          {isHe
            ? `${personName} — אישור קבלת €${amount} מהקופה`
            : `${personName} — confirming receipt of €${amount} from kitty`}
        </p>

        <div className="border-2 border-gray-200 rounded-2xl overflow-hidden bg-white">
          <canvas
            ref={canvasRef}
            width={600}
            height={220}
            className="w-full touch-none cursor-crosshair"
            onMouseDown={startDraw}
            onMouseMove={draw}
            onMouseUp={endDraw}
            onMouseLeave={endDraw}
            onTouchStart={startDraw}
            onTouchMove={draw}
            onTouchEnd={endDraw}
          />
        </div>

        <p className="text-xs text-gray-400 text-center">
          {isHe ? 'חתום עם האצבע או העכבר' : 'Sign with finger or mouse'}
        </p>

        <div className="flex gap-3">
          <button
            onClick={clear}
            className="px-5 py-4 rounded-2xl border-2 border-gray-200 text-gray-500 font-semibold active:bg-gray-50 transition-colors"
          >
            {isHe ? 'נקה' : 'Clear'}
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-4 rounded-2xl border-2 border-gray-200 text-gray-700 font-semibold active:bg-gray-50 transition-colors"
          >
            {isHe ? 'דלג' : 'Skip'}
          </button>
          <button
            onClick={save}
            disabled={empty}
            className="flex-1 py-4 rounded-2xl bg-blue-600 text-white font-bold active:bg-blue-700 disabled:opacity-40 transition-colors"
          >
            {isHe ? 'שמור חתימה' : 'Save'}
          </button>
        </div>
      </div>
    </Modal>
  )
}
