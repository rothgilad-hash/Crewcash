import { createContext, useContext, useState, useEffect, useCallback } from 'react'
import { supabase } from '../lib/supabase'

const AppContext = createContext(null)

export function AppProvider({ children }) {
  const [trip, setTrip] = useState(null)
  const [participants, setParticipants] = useState([])
  const [expenses, setExpenses] = useState([])
  const [shoppingItems, setShoppingItems] = useState([])
  const [kittyRefunds, setKittyRefunds] = useState([])
  const [isAdmin, setIsAdmin] = useState(false)
  const [loading, setLoading] = useState(true)
  const [lang, setLang] = useState(localStorage.getItem('crewcash_lang') || 'he')

  const loadTrip = useCallback(async (tripId) => {
    const { data: tripData } = await supabase.from('trips').select('*').eq('id', tripId).single()
    if (!tripData) return false
    setTrip(tripData)

    const [{ data: parts }, { data: exps }, { data: items }] = await Promise.all([
      supabase.from('participants').select('*').eq('trip_id', tripId).order('created_at'),
      supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }),
      supabase.from('shopping_items').select('*').eq('trip_id', tripId).order('category').order('created_at')
    ])

    setParticipants(parts || [])
    setExpenses(exps || [])
    setShoppingItems(items || [])

    const partIds = (parts || []).map(p => p.id)
    if (partIds.length > 0) {
      const { data: refunds } = await supabase.from('kitty_refunds').select('*').in('participant_id', partIds).order('created_at')
      setKittyRefunds(refunds || [])
    }

    const storedAdmin = localStorage.getItem('crewcash_admin_' + tripId)
    if (storedAdmin && storedAdmin === tripData.admin_token) setIsAdmin(true)

    return true
  }, [])

  useEffect(() => {
    const savedTripId = localStorage.getItem('crewcash_trip_id')
    if (savedTripId) {
      loadTrip(savedTripId).finally(() => setLoading(false))
    } else {
      setLoading(false)
    }
  }, [loadTrip])

  const reloadShoppingItems = useCallback((tripId) => {
    supabase.from('shopping_items').select('*').eq('trip_id', tripId).order('category').order('created_at')
      .then(({ data }) => setShoppingItems(data || []))
  }, [])

  const reloadExpenses = useCallback((tripId) => {
    supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false })
      .then(({ data }) => setExpenses(data || []))
  }, [])

  const reloadRefunds = useCallback((participantIds) => {
    if (!participantIds?.length) return
    supabase.from('kitty_refunds').select('*').in('participant_id', participantIds).order('created_at')
      .then(({ data }) => setKittyRefunds(data || []))
  }, [])

  useEffect(() => {
    if (!trip) return
    const tripId = trip.id
    const channel = supabase.channel('trip-' + tripId)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'expenses', filter: `trip_id=eq.${tripId}` },
        () => supabase.from('expenses').select('*').eq('trip_id', tripId).order('created_at', { ascending: false }).then(({ data }) => setExpenses(data || [])))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'participants', filter: `trip_id=eq.${tripId}` },
        () => supabase.from('participants').select('*').eq('trip_id', tripId).order('created_at').then(({ data }) => {
          setParticipants(data || [])
          reloadRefunds((data || []).map(p => p.id))
        }))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'shopping_items', filter: `trip_id=eq.${tripId}` },
        () => supabase.from('shopping_items').select('*').eq('trip_id', tripId).order('category').order('created_at').then(({ data }) => setShoppingItems(data || [])))
      .on('postgres_changes', { event: '*', schema: 'public', table: 'kitty_refunds' },
        () => supabase.from('participants').select('id').eq('trip_id', tripId)
            .then(({ data }) => reloadRefunds((data || []).map(p => p.id))))
      .subscribe()

    return () => supabase.removeChannel(channel)
  }, [trip, reloadRefunds])

  const joinTrip = async (inviteCode) => {
    const { data } = await supabase.from('trips').select('*').eq('invite_token', inviteCode.toLowerCase()).single()
    if (!data) throw new Error('Trip not found')
    localStorage.setItem('crewcash_trip_id', data.id)
    await loadTrip(data.id)
    return data
  }

  const createTrip = async (tripData) => {
    const { data, error } = await supabase.from('trips').insert(tripData).select().single()
    if (error) throw error
    localStorage.setItem('crewcash_trip_id', data.id)
    localStorage.setItem('crewcash_admin_' + data.id, data.admin_token)
    setIsAdmin(true)
    setTrip(data)
    setParticipants([])
    setExpenses([])
    setShoppingItems([])
    setKittyRefunds([])
    return data
  }

  const leaveTrip = () => {
    if (trip) localStorage.removeItem('crewcash_admin_' + trip.id)
    localStorage.removeItem('crewcash_trip_id')
    setTrip(null)
    setParticipants([])
    setExpenses([])
    setShoppingItems([])
    setKittyRefunds([])
    setIsAdmin(false)
  }

  const changeLang = (l) => {
    setLang(l)
    localStorage.setItem('crewcash_lang', l)
  }

  return (
    <AppContext.Provider value={{
      trip, setTrip, participants, expenses, shoppingItems, kittyRefunds,
      isAdmin, loading, lang,
      loadTrip, joinTrip, createTrip, leaveTrip, changeLang, reloadRefunds, reloadExpenses, reloadShoppingItems,
      setParticipants, setExpenses, setShoppingItems
    }}>
      {children}
    </AppContext.Provider>
  )
}

export const useApp = () => {
  const ctx = useContext(AppContext)
  if (!ctx) throw new Error('useApp must be used within AppProvider')
  return ctx
}
