import React, { useState } from 'react';
import { Save, Shield, Bell, Bot, Database, Key, Send } from 'lucide-react';
import { useApp } from '../context/AppContext';
import { testTelegramBot } from '../agents/telegram';

// Self-updating range slider with live cyan fill
const RangeSlider = ({ min, max, value, onChange, unit = '' }) => {
  const pct = Math.round(((value - min) / (max - min)) * 100);
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
      <div style={{ flex: 1, position: 'relative', padding: '8px 0' }}>
        <input
          type="range"
          min={min}
          max={max}
          value={value}
          onChange={e => onChange(+e.target.value)}
          style={{
            width: '100%',
            background: `linear-gradient(to right, var(--accent-cyan) ${pct}%, var(--bg-surface) ${pct}%)`,
            cursor: 'pointer',
          }}
        />
      </div>
      <span style={{
        fontFamily: 'var(--font-mono)',
        fontWeight: 700,
        fontSize: 14,
        color: 'var(--accent-cyan)',
        minWidth: 44,
        textAlign: 'right',
      }}>{value}{unit}</span>
    </div>
  );
};

const Field = ({ label, children, full }) => (
  <div className="form-group" style={full ? { gridColumn: '1 / -1' } : {}}>
    <label className="form-label">{label}</label>
    {children}
  </div>
);

const Toggle = ({ label, desc, keyName, checked, onChange }) => (
  <div className="bot-control" style={{ margin: 0 }}>
    <div className="bot-control-info">
      <div className="bot-control-name">{label}</div>
      {desc && <div className="bot-control-desc">{desc}</div>}
    </div>
    <label className="toggle">
      <input type="checkbox" checked={checked} onChange={e => onChange(keyName, e.target.checked)} />
      <span className="toggle-slider" />
    </label>
  </div>
);

const Settings = () => {
  const { persistSettings, firebaseReady, userSettings } = useApp();
  const [saved, setSaved]               = useState(false);
  const [tgTesting, setTgTesting]       = useState(false);
  const [tgTestResult, setTgTestResult] = useState(null); // { ok, message }
  const [settings, setSettings] = useState({
    linkedinEmail: '',
    linkedinPassword: '',
    telegramToken: '',
    telegramChatId: '',
    maxApplicationsPerDay: 20,
    maxConnectionsPerDay: 25,
    minMatchScore: 75,
    searchKeywords: 'React Developer, Frontend Engineer, Full Stack Developer',
    searchLocation: 'Remote, San Francisco, New York',
    notifyNewJobs: true,
    notifyApplications: true,
    notifyConnections: false,
    stealthMode: true,
    respectRobotsTxt: true,
    randomDelays: true,
    // ── Profile / Application Data ─────────────────────────────
    phone: '',
    yearsExperience: '3',
    additionalMonthsExperience: '0',
    englishProficiency: 'Professional',
    availableFullTime: 'Yes',
    canWorkCETHours: 'Yes',
    coverLetter: '',
    linkedinProfileUrl: '',
    portfolioUrl: '',
    currentSalary: '',
    expectedSalary: '',
    variablePay: '0.0',
    stockRsuValue: '0.0',
    noticePeriod: 'Immediately',
    currentCity: '',
    currentCountry: 'India',
  });

  // Load saved settings from Firebase/AppContext when available
  // Use a ref to only run once when real settings first arrive
  const settingsLoadedRef = React.useRef(false);
  React.useEffect(() => {
    if (userSettings && Object.keys(userSettings).length > 0 && !settingsLoadedRef.current) {
      settingsLoadedRef.current = true;
      setSettings(prev => ({ ...prev, ...userSettings }));
    }
  }, [userSettings]);

  const update = (key, val) => setSettings(prev => ({ ...prev, [key]: val }));

  const handleSave = async () => {
    try {
      await persistSettings(settings);
      setSaved(true);
      setTimeout(() => setSaved(false), 2500);
    } catch (err) {
      console.error('Failed to save settings:', err);
      alert('❌ Failed to save settings: ' + err.message);
    }
  };

  const handleTestTelegram = async () => {
    const token  = settings.telegramToken?.trim()  || userSettings?.telegramToken?.trim();
    const chatId = settings.telegramChatId?.trim() || userSettings?.telegramChatId?.trim();

    console.log('🔍 Telegram test — token:', token ? token.slice(0,15)+'...' : 'EMPTY', '| chatId:', chatId || 'EMPTY');

    if (!token || !chatId) {
      setTgTestResult({ ok: false, message: '❌ Enter Token and Chat ID above, then try again' });
      return;
    }
    setTgTesting(true);
    setTgTestResult(null);
    try {
      await testTelegramBot(token, chatId);
      setTgTestResult({ ok: true, message: '✅ Message sent! Check your Telegram.' });
    } catch (e) {
      console.error('Telegram error:', e.message);
      setTgTestResult({ ok: false, message: `❌ ${e.message}` });
    } finally {
      setTgTesting(false);
      setTimeout(() => setTgTestResult(null), 6000);
    }
  };

  return (
    <div className="page-content animate-fade" style={{ maxWidth: 860 }}>
      {/* LinkedIn Credentials */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title"><Key size={15} /> LinkedIn Credentials</div>
          <span className="badge badge-amber">Stored Locally Only</span>
        </div>
        <div className="card-body">
          <div className="grid-2" style={{ gap: 16 }}>
            <Field label="LinkedIn Email">
              <input className="form-input" type="email" placeholder="your@email.com"
                value={settings.linkedinEmail} onChange={e => update('linkedinEmail', e.target.value)} />
            </Field>
            <Field label="LinkedIn Password">
              <input className="form-input" type="password" placeholder="••••••••••"
                value={settings.linkedinPassword} onChange={e => update('linkedinPassword', e.target.value)} />
            </Field>
          </div>
          <div style={{ background: 'rgba(255,184,0,0.06)', border: '1px solid rgba(255,184,0,0.2)', borderRadius: 'var(--radius-md)', padding: '10px 14px', marginTop: 12 }}>
            <p className="text-xs" style={{ color: 'var(--accent-amber)' }}>⚠️ Credentials are encrypted and stored in your private Firestore database (only you can access them). They are sent only to your local backend server to log in to LinkedIn. Use a secondary account for extra safety.</p>
          </div>
        </div>
      </div>

      {/* Profile / Application Data */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title">👤 Profile & Application Data</div>
          <span className="badge badge-cyan">Used in Easy Apply forms</span>
        </div>
        <div className="card-body">
          <div className="grid-2" style={{ gap: 16 }}>

            <Field label="Phone Number (with country code)">
              <input className="form-input" type="tel" placeholder="+91 9876543210"
                value={settings.phone} onChange={e => update('phone', e.target.value)} />
            </Field>

            <Field label="LinkedIn Profile URL">
              <input className="form-input" placeholder="https://linkedin.com/in/yourname"
                value={settings.linkedinProfileUrl} onChange={e => update('linkedinProfileUrl', e.target.value)} />
            </Field>

            <Field label="Total Years of Experience">
              <select className="form-select" value={settings.yearsExperience} onChange={e => update('yearsExperience', e.target.value)}>
                {['0','1','2','3','4','5','6','7','8','9','10','11','12','13','14','15','16','17','18','19','20+'].map(v => (
                  <option key={v} value={v}>{v} {v === '1' ? 'year' : 'years'}</option>
                ))}
              </select>
            </Field>

            <Field label="Additional Months of Experience">
              <select className="form-select" value={settings.additionalMonthsExperience} onChange={e => update('additionalMonthsExperience', e.target.value)}>
                {['0','1','2','3','4','5','6','7','8','9','10','11'].map(v => (
                  <option key={v} value={v}>{v} {v === '1' ? 'month' : 'months'}</option>
                ))}
              </select>
            </Field>

            <Field label="English Proficiency">
              <select className="form-select" value={settings.englishProficiency} onChange={e => update('englishProficiency', e.target.value)}>
                {['Native or Bilingual','Full Professional','Professional','Limited Working','Elementary'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>

            <Field label="Notice Period">
              <select className="form-select" value={settings.noticePeriod} onChange={e => update('noticePeriod', e.target.value)}>
                {['Immediately','1 Week','2 Weeks','1 Month','2 Months','3 Months'].map(v => (
                  <option key={v} value={v}>{v}</option>
                ))}
              </select>
            </Field>

            <Field label="Available Full-Time?">
              <select className="form-select" value={settings.availableFullTime} onChange={e => update('availableFullTime', e.target.value)}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </Field>

            <Field label="Can Work CET Business Hours?">
              <select className="form-select" value={settings.canWorkCETHours} onChange={e => update('canWorkCETHours', e.target.value)}>
                <option value="Yes">Yes</option>
                <option value="No">No</option>
              </select>
            </Field>

            <Field label="Current City">
              <input className="form-input" placeholder="Chennai"
                value={settings.currentCity} onChange={e => update('currentCity', e.target.value)} />
            </Field>

            <Field label="Current Country">
              <input className="form-input" placeholder="India"
                value={settings.currentCountry} onChange={e => update('currentCountry', e.target.value)} />
            </Field>

            <Field label="Portfolio / Website URL">
              <input className="form-input" placeholder="https://yourportfolio.com"
                value={settings.portfolioUrl} onChange={e => update('portfolioUrl', e.target.value)} />
            </Field>

            <Field label="Expected Salary (annual, in local currency)">
              <input className="form-input" placeholder="e.g. 1200000"
                value={settings.expectedSalary} onChange={e => update('expectedSalary', e.target.value)} />
            </Field>

            <Field label="Variable Pay / Performance Bonus (annual)">
              <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g. 150000 or 0.0"
                value={settings.variablePay} onChange={e => update('variablePay', e.target.value)} />
            </Field>

            <Field label="Stock / RSU Value (annual, in local currency)">
              <input className="form-input" type="number" step="0.01" min="0" placeholder="e.g. 200000 or 0.0"
                value={settings.stockRsuValue} onChange={e => update('stockRsuValue', e.target.value)} />
            </Field>

            <Field label="Cover Letter / Summary" full>
              <textarea className="form-textarea" rows={4}
                placeholder="Write a short professional summary to use in text boxes on application forms..."
                value={settings.coverLetter}
                onChange={e => update('coverLetter', e.target.value)}
                style={{ minHeight: 100 }}
              />
            </Field>

          </div>
        </div>
      </div>

      {/* Job Search Preferences */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title"><Bot size={15} /> Bot Preferences</div>
        </div>
        <div className="card-body">
          <div className="grid-2" style={{ gap: 16 }}>
            <Field label="Search Keywords" full>
              <input className="form-input" value={settings.searchKeywords} onChange={e => update('searchKeywords', e.target.value)} />
            </Field>
            <Field label="Locations">
              <input className="form-input" value={settings.searchLocation} onChange={e => update('searchLocation', e.target.value)} />
            </Field>
            <Field label="Min AI Match Score (%)">
              <RangeSlider min={50} max={100} value={settings.minMatchScore}
                onChange={v => update('minMatchScore', v)} unit="%" />
            </Field>
            <Field label="Max Applications / Day">
              <RangeSlider min={1} max={50} value={settings.maxApplicationsPerDay}
                onChange={v => update('maxApplicationsPerDay', v)} />
            </Field>
            <Field label="Max Connections / Day">
              <RangeSlider min={1} max={50} value={settings.maxConnectionsPerDay}
                onChange={v => update('maxConnectionsPerDay', v)} />
            </Field>
          </div>
        </div>
      </div>

      {/* Stealth Settings */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title"><Shield size={15} /> Stealth & Safety</div>
        </div>
        <div className="card-body" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          <Toggle keyName="stealthMode" label="Playwright Stealth Mode" desc="Obfuscate automation fingerprints (userAgent, webdriver flag)" checked={settings.stealthMode} onChange={update} />
          <Toggle keyName="randomDelays" label="Random Delays" desc="2–5s randomized delays between actions to mimic human behavior" checked={settings.randomDelays} onChange={update} />
          <Toggle keyName="respectRobotsTxt" label="Respect robots.txt" desc="Only access pages allowed by LinkedIn's robots.txt" checked={settings.respectRobotsTxt} onChange={update} />
        </div>
      </div>

      {/* Notifications */}
      <div className="card mb-20">
        <div className="card-header">
          <div className="card-title"><Bell size={15} /> Notifications</div>
        </div>
        <div className="card-body">
          <div className="grid-2" style={{ gap: 16, marginBottom: 16 }}>
            <Field label="Telegram Bot Token">
              <input className="form-input" placeholder="1234567890:AAF..." value={settings.telegramToken}
                onChange={e => update('telegramToken', e.target.value)} />
            </Field>
            <Field label="Telegram Chat ID">
              <input className="form-input" placeholder="-100123456789" value={settings.telegramChatId}
                onChange={e => update('telegramChatId', e.target.value)} />
            </Field>
          </div>

          {/* Test Bot button */}
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 16 }}>
            <button
              className="btn btn-secondary"
              onClick={handleTestTelegram}
              disabled={tgTesting}
              style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 13 }}
            >
              <Send size={13} />{tgTesting ? 'Sending...' : 'Test Bot Connection'}
            </button>
            {tgTestResult && (
              <span style={{ fontSize: 13, color: tgTestResult.ok ? 'var(--accent-green)' : 'var(--accent-red)' }}>
                {tgTestResult.ok ? '✅' : '❌'} {tgTestResult.message || tgTestResult.error}
              </span>
            )}
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            <Toggle keyName="notifyNewJobs" label="New Job Matches" desc="Alert when high-match jobs are found" checked={settings.notifyNewJobs} onChange={update} />
            <Toggle keyName="notifyApplications" label="Application Updates" desc="Alert on interview invites and responses" checked={settings.notifyApplications} onChange={update} />
            <Toggle keyName="notifyConnections" label="Connection Accepted" desc="Alert when a connection request is accepted" checked={settings.notifyConnections} onChange={update} />
          </div>
        </div>
      </div>

      {/* Firebase */}
      <div className="card mb-28">
        <div className="card-header">
          <div className="card-title"><Database size={15} /> Firebase Connection</div>
          <span className="badge badge-green">Connected</span>
        </div>
        <div className="card-body">
          <p className="text-secondary text-sm mb-12">Firebase is used to store your job data, resumes, and application history. Update <code className="font-mono" style={{ color: 'var(--accent-cyan)', fontSize: 11 }}>src/firebase/config.js</code> with your project credentials.</p>
          <div className="grid-2" style={{ gap: 10 }}>
            {['Firestore', 'Auth', 'Storage', 'Hosting'].map(svc => (
              <div key={svc} className="flex items-center gap-8" style={{ padding: '8px 12px', background: 'var(--bg-secondary)', borderRadius: 'var(--radius-md)', border: '1px solid var(--border)' }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: 'var(--accent-green)' }} />
                <span className="text-sm">{svc}</span>
                <span className="badge badge-green ml-auto" style={{ fontSize: 10 }}>Free Tier</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      <button className="btn btn-primary btn-lg w-full" onClick={handleSave}>
        {saved
          ? `✅ Settings Saved${firebaseReady ? ' to Firebase' : ' Locally'}!`
          : <><Save size={15} /> Save All Settings</>}
      </button>
    </div>
  );
};

export default Settings;
