import { useEffect, useState } from 'react'
import { Button, Card, ErrorBox, Field, Input, Page, TopBar } from '../../components/ui'
import { useAuth } from '../../lib/auth'
import { errorText } from '../../lib/errors'
import { phone } from '../../lib/format'
import { supabase } from '../../lib/supabase'
import type { Profile } from '../../lib/types'

export default function PeoplePage() {
  const { profile, refreshProfile } = useAuth()
  const [name, setName] = useState(profile?.name ?? '')
  const [tel, setTel] = useState(profile?.phone ?? '')
  const [title, setTitle] = useState(profile?.role_title ?? '')
  const [showPhone, setShowPhone] = useState(profile?.show_phone_public ?? false)
  const [admins, setAdmins] = useState<Profile[]>([])
  const [newEmail, setNewEmail] = useState('')
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function loadAdmins() {
    const { data } = await supabase.from('profiles').select('*').eq('is_admin', true).order('created_at')
    setAdmins((data as Profile[]) ?? [])
  }
  useEffect(() => {
    void loadAdmins()
  }, [])

  async function saveProfile() {
    setError('')
    const { error } = await supabase
      .from('profiles')
      .update({ name: name.trim(), phone: tel.trim(), role_title: title.trim(), show_phone_public: showPhone })
      .eq('user_id', profile!.user_id)
    if (error) return setError(errorText(error))
    setSaved(true)
    await refreshProfile()
    await loadAdmins()
  }

  async function setAdmin(email: string, value: boolean) {
    setError('')
    const { error } = await supabase.rpc('set_admin', { p_email: email, p_is_admin: value })
    if (error) return setError(errorText(error))
    setNewEmail('')
    await loadAdmins()
  }

  return (
    <>
      <TopBar title="Innstillinger" back="/admin" />
      <Page>
        <Card>
          <form
            className="space-y-3"
            onSubmit={(e) => {
              e.preventDefault()
              void saveProfile()
            }}
          >
            <h2 className="text-lg font-bold">Din profil</h2>
            <p className="text-sm text-muted">Navnet og rollen din vises offentlig på alle sider i dugnaden.</p>
            <Field label="Navn">
              <Input value={name} onChange={(e) => { setName(e.target.value); setSaved(false) }} />
            </Field>
            <Field label="Rolle" hint="For eksempel kasserer eller koordinator">
              <Input value={title} onChange={(e) => { setTitle(e.target.value); setSaved(false) }} />
            </Field>
            <Field label="Telefon">
              <Input inputMode="tel" value={tel} onChange={(e) => { setTel(e.target.value); setSaved(false) }} />
            </Field>
            <label className="flex items-center gap-2">
              <input type="checkbox" className="h-5 w-5" checked={showPhone} onChange={(e) => { setShowPhone(e.target.checked); setSaved(false) }} />
              Vis telefonnummeret mitt offentlig
            </label>
            <Button type="submit">{saved ? 'Lagret ✓' : 'Lagre'}</Button>
          </form>
        </Card>

        <Card className="space-y-3">
          <h2 className="text-lg font-bold">Administratorer</h2>
          {admins.map((a) => (
            <div key={a.user_id} className="flex items-center justify-between gap-2 text-sm">
              <div>
                <div className="font-semibold">{a.name || a.email}</div>
                <div className="text-muted">
                  {[a.role_title, a.show_phone_public ? phone(a.phone) : 'telefon skjult', a.email].filter(Boolean).join(' · ')}
                </div>
              </div>
              {a.user_id !== profile?.user_id && (
                <button type="button" className="text-red-700" onClick={() => void setAdmin(a.email, false)}>
                  Fjern
                </button>
              )}
            </div>
          ))}
          <form
            className="space-y-2 border-t border-line pt-3"
            onSubmit={(e) => {
              e.preventDefault()
              void setAdmin(newEmail, true)
            }}
          >
            <Field label="Legg til admin (e-post)" hint="Personen må ha logget inn én gang først, på /logg-inn">
              <Input type="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </Field>
            <Button type="submit" variant="secondary" disabled={!newEmail.includes('@')}>
              Legg til
            </Button>
          </form>
          <ErrorBox>{error}</ErrorBox>
        </Card>
      </Page>
    </>
  )
}
