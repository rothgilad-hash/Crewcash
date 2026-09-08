import { useState, useEffect, useRef } from 'react'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { Lightbulb, Plus, Camera } from 'lucide-react'
import { motion } from 'framer-motion'

export default function Notes() {
  const { trip, isAdmin, lang } = useApp()
  const isHe = lang === 'he'
  const [notes, setNotes] = useState([])
  const [loading, setLoading] = useState(true)
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState(null)
  const [content, setContent] = useState('')
  const [photos, setPhotos] = useState([])
  const [uploading, setUploading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileInputRef = useRef(null)

  const loadNotes = async () => {
    const { data } = await supabase
      .from('trip_notes')
      .select('*')
      .eq('trip_id', trip.id)
      .order('created_at', { ascending: false })
    setNotes(data || [])
    setLoading(false)
  }

  useEffect(() => { loadNotes() }, [trip.id])

  const openAdd = () => {
    setContent('')
    setPhotos([])
    setEditing(null)
    setFormOpen(true)
  }

  const openEdit = (note) => {
    setContent(note.content || '')
    setPhotos(note.photos || [])
    setEditing(note)
    setFormOpen(true)
  }

  const closeForm = () => {
    setFormOpen(false)
    setEditing(null)
    setContent('')
    setPhotos([])
  }

  const handlePhotoUpload = async (e) => {
    const file = e.target.files[0]
    if (!file) return
    setUploading(true)
    const ext = file.name.split('.').pop()
    const path = `notes/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`
    const { error } = await supabase.storage.from('receipts').upload(path, file, { upsert: true })
    if (error) { alert('שגיאת העלאה: ' + error.message); setUploading(false); return }
    const { data } = supabase.storage.from('receipts').getPublicUrl(path)
    setPhotos(prev => [...prev, data.publicUrl])
    setUploading(false)
    e.target.value = ''
  }

  const handleSave = async () => {
    if (!content.trim() && photos.length === 0) return
    setSaving(true)
    if (editing) {
      await supabase.from('trip_notes').update({ content: content.trim(), photos }).eq('id', editing.id)
    } else {
      await supabase.from('trip_notes').insert({ trip_id: trip.id, content: content.trim(), photos })
    }
    await loadNotes()
    setSaving(false)
    closeForm()
  }

  const handleDelete = async (note) => {
    if (!window.confirm(isHe ? 'למחוק את ההערה?' : 'Delete this note?')) return
    await supabase.from('trip_notes').delete().eq('id', note.id)
    loadNotes()
  }

  const formatDate = (iso) =>
    new Date(iso).toLocaleDateString(isHe ? 'he-IL' : 'en-GB', {
      day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit'
    })

  return (
    <div className="p-4 space-y-4">

      {isAdmin && !formOpen && (
        <button
          onClick={openAdd}
          className="w-full py-3.5 bg-blue-600 text-white rounded-2xl font-bold text-sm flex items-center justify-center gap-2 active:bg-blue-700 transition-colors"
        >
          <Plus size={18} />
          {isHe ? '+ הוסף תובנה' : '+ Add insight'}
        </button>
      )}

      {formOpen && (
        <motion.div
          initial={{ opacity: 0, y: -8 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 space-y-3"
        >
          <textarea
            className="w-full border-2 border-gray-200 rounded-2xl px-4 py-3 text-sm focus:outline-none focus:border-blue-500 resize-none bg-white text-gray-900"
            rows={4}
            placeholder={isHe ? 'כתוב תובנה, רעיון, הערה...' : 'Write an insight, idea, or note...'}
            value={content}
            onChange={e => setContent(e.target.value)}
            autoFocus
          />

          {photos.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {photos.map((url, i) => (
                <div key={i} className="relative">
                  <img src={url} alt="" className="w-20 h-20 object-cover rounded-xl" />
                  <button
                    onClick={() => setPhotos(prev => prev.filter((_, j) => j !== i))}
                    className="absolute -top-1.5 -right-1.5 w-5 h-5 bg-red-500 text-white rounded-full flex items-center justify-center text-xs leading-none"
                  >✕</button>
                </div>
              ))}
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
              className="flex items-center gap-1.5 px-3 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-600 active:bg-gray-50 transition-colors"
            >
              <Camera size={16} />
              {uploading ? '...' : (isHe ? 'תמונה' : 'Photo')}
            </button>
            <button
              onClick={closeForm}
              className="flex-1 py-2.5 border-2 border-gray-200 rounded-xl text-sm text-gray-600 active:bg-gray-50 transition-colors"
            >
              {isHe ? 'ביטול' : 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              disabled={saving || (!content.trim() && photos.length === 0)}
              className="flex-1 py-2.5 bg-blue-600 text-white rounded-xl text-sm font-bold active:bg-blue-700 disabled:opacity-40 transition-colors"
            >
              {saving ? '...' : (isHe ? 'שמור' : 'Save')}
            </button>
          </div>
          <input ref={fileInputRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handlePhotoUpload} />
        </motion.div>
      )}

      {loading ? (
        <div className="text-center py-10 text-gray-400 text-sm">טוען...</div>
      ) : notes.length === 0 ? (
        <div className="text-center py-16">
          <Lightbulb size={44} className="mx-auto text-gray-200 mb-3" />
          <p className="text-gray-400 text-sm font-medium">{isHe ? 'אין תובנות עדיין' : 'No insights yet'}</p>
          {isAdmin && <p className="text-gray-300 text-xs mt-1">{isHe ? 'לחץ + כדי להוסיף' : 'Tap + to add one'}</p>}
        </div>
      ) : (
        notes.map((note, idx) => (
          <motion.div
            key={note.id}
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: idx * 0.04 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 p-4 space-y-3"
          >
            <div className="flex items-start gap-2">
              {note.content && (
                <p className="flex-1 text-sm text-gray-800 leading-relaxed whitespace-pre-wrap">{note.content}</p>
              )}
              {isAdmin && (
                <div className="flex gap-0.5 flex-shrink-0">
                  <button onClick={() => openEdit(note)} className="p-1.5 text-gray-300 active:text-blue-500 rounded-lg text-base">✏️</button>
                  <button onClick={() => handleDelete(note)} className="p-1.5 text-gray-300 active:text-red-500 rounded-lg text-base">🗑️</button>
                </div>
              )}
            </div>

            {note.photos?.length > 0 && (
              <div className="flex flex-wrap gap-2">
                {note.photos.map((url, i) => (
                  <img
                    key={i}
                    src={url}
                    alt=""
                    className="w-24 h-24 object-cover rounded-xl cursor-pointer active:opacity-80"
                    onClick={() => setLightbox(url)}
                  />
                ))}
              </div>
            )}

            <p className="text-[10px] text-gray-300">{formatDate(note.created_at)}</p>
          </motion.div>
        ))
      )}

      {/* Lightbox */}
      {lightbox && (
        <div
          className="fixed inset-0 bg-black/80 z-50 flex items-center justify-center p-4"
          onClick={() => setLightbox(null)}
        >
          <img src={lightbox} alt="" className="max-w-full max-h-full rounded-2xl object-contain" />
        </div>
      )}
    </div>
  )
}
