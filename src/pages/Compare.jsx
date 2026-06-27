import { useState, useEffect } from 'react'
import { useTranslation } from 'react-i18next'
import { useApp } from '../context/AppContext'
import { supabase } from '../lib/supabase'
import { formatCurrency, getCategoryIcon } from '../lib/calculations'
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts'
import { motion } from 'framer-motion'

export default function Compare() {
  const { t, i18n } = useTranslation()
  const { trip, expenses, participants, lang } = useApp()
  const [allTrips, setAllTrips] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    supabase.from('trips').select('*, expenses(*), participants(*)').order('year').then(({ data }) => {
      setAllTrips(data || [])
      setLoading(false)
    })
  }, [])

  const isHe = lang === 'he'

  const tripData = allTrips.map(trip => {
    const total = (trip.expenses || []).reduce((s, e) => s + e.amount, 0)
    const pCount = (trip.participants || []).length
    return {
      name: `${trip.year}`,
      total: Math.round(total),
      perPerson: pCount > 0 ? Math.round(total / pCount) : 0,
      participants: pCount,
      label: trip.name
    }
  })

  const currentYear = trip?.year
  const COLORS = ['#93C5FD', '#60A5FA', '#3B82F6', '#2563EB', '#1D4ED8']

  const categoryData = expenses.reduce((acc, e) => {
    acc[e.category] = (acc[e.category] || 0) + e.amount
    return acc
  }, {})

  const catChart = Object.entries(categoryData)
    .sort((a, b) => b[1] - a[1])
    .map(([cat, amount]) => ({ name: t('cat_' + cat), icon: getCategoryIcon(cat), amount: Math.round(amount) }))

  if (loading) return <div className="p-8 text-center text-gray-400">{t('loading')}</div>

  return (
    <div className="p-4 space-y-5">
      {allTrips.length < 2 ? (
        <div className="flex flex-col items-center justify-center py-20 text-center">
          <span className="text-5xl mb-4">📊</span>
          <p className="text-gray-400 font-medium">{t('noOtherTrips')}</p>
          <p className="text-gray-300 text-sm mt-1">{isHe ? 'לאחר שיוטים נוספים יופיע כאן גרף השוואה' : 'After more trips, a comparison chart will appear'}</p>
        </div>
      ) : (
        <>
          {/* Total cost chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">{t('totalCost')} 💶</h3>
            <ResponsiveContainer width="100%" height={200}>
              <BarChart data={tripData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`€${v.toLocaleString()}`, '']} />
                <Bar dataKey="total" radius={[8, 8, 0, 0]}>
                  {tripData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === String(currentYear) ? '#2563EB' : '#BFDBFE'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Per person chart */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}
            className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
            <h3 className="font-bold text-gray-900 mb-4">{t('costPerPerson')} 👤</h3>
            <ResponsiveContainer width="100%" height={180}>
              <BarChart data={tripData} margin={{ top: 0, right: 0, left: -20, bottom: 0 }}>
                <XAxis dataKey="name" tick={{ fontSize: 12, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 11, fill: '#9CA3AF' }} axisLine={false} tickLine={false} />
                <Tooltip formatter={(v) => [`€${v.toLocaleString()}`, '']} />
                <Bar dataKey="perPerson" radius={[8, 8, 0, 0]}>
                  {tripData.map((entry, i) => (
                    <Cell key={i} fill={entry.name === String(currentYear) ? '#10B981' : '#A7F3D0'} />
                  ))}
                </Bar>
              </BarChart>
            </ResponsiveContainer>
          </motion.div>

          {/* Table */}
          <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}
            className="bg-white rounded-3xl shadow-sm border border-gray-100 overflow-hidden">
            <div className="grid grid-cols-4 text-xs text-gray-400 font-medium px-4 py-3 border-b border-gray-50 bg-gray-50">
              <span>{isHe ? 'שנה' : 'Year'}</span>
              <span className="text-center">{isHe ? 'משתתפים' : 'People'}</span>
              <span className="text-center">{t('totalCost')}</span>
              <span className="text-center">{t('costPerPerson')}</span>
            </div>
            {tripData.map((row, i) => (
              <div key={i} className={`grid grid-cols-4 px-4 py-3.5 border-b border-gray-50 last:border-0 ${row.name === String(currentYear) ? 'bg-blue-50' : ''}`}>
                <span className={`font-bold ${row.name === String(currentYear) ? 'text-blue-600' : 'text-gray-700'}`}>{row.name}</span>
                <span className="text-center text-gray-600">{row.participants}</span>
                <span className="text-center font-semibold text-gray-900">€{row.total.toLocaleString()}</span>
                <span className="text-center font-semibold text-gray-900">€{row.perPerson.toLocaleString()}</span>
              </div>
            ))}
          </motion.div>
        </>
      )}

      {/* Current trip breakdown */}
      {catChart.length > 0 && (
        <motion.div initial={{ opacity: 0, y: 10 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }}
          className="bg-white rounded-3xl p-5 shadow-sm border border-gray-100">
          <h3 className="font-bold text-gray-900 mb-4">{isHe ? 'פירוט לפי קטגוריה - השיוט הנוכחי' : 'Current trip by category'}</h3>
          <div className="space-y-3">
            {catChart.map((cat, i) => {
              const max = catChart[0].amount
              return (
                <div key={i} className="flex items-center gap-3">
                  <span className="text-xl w-8 text-center flex-shrink-0">{cat.icon}</span>
                  <div className="flex-1">
                    <div className="flex justify-between text-sm mb-1">
                      <span className="text-gray-700 font-medium">{cat.name}</span>
                      <span className="text-gray-900 font-bold">€{cat.amount.toLocaleString()}</span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-2">
                      <div className="h-2 rounded-full bg-blue-500 transition-all" style={{ width: `${(cat.amount / max) * 100}%` }} />
                    </div>
                  </div>
                </div>
              )
            })}
          </div>
        </motion.div>
      )}
    </div>
  )
}
