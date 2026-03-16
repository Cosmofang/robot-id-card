/**
 * RIC Popup — shows current bot identity status
 */

const GRADE_CONFIG = {
  healthy: { emoji: '🟢', label: 'Healthy', cssClass: 'grade-healthy' },
  unknown: { emoji: '🟡', label: 'Unknown', cssClass: 'grade-unknown' },
  dangerous: { emoji: '🔴', label: 'Dangerous', cssClass: 'grade-dangerous' },
}

const PERMISSION_LABELS = ['Blocked', 'Read', 'View Threads', 'React', 'Post', 'Chat']

async function getStatus(): Promise<{ configured: boolean; ricId?: string }> {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ type: 'GET_STATUS' }, resolve)
  })
}

async function fetchCert(ricId: string) {
  try {
    const res = await fetch(`https://registry.robotidcard.dev/v1/bots/${ricId}`)
    if (!res.ok) return null
    return res.json()
  } catch {
    return null
  }
}

function renderConfigured(cert: any) {
  const grade = GRADE_CONFIG[cert.grade as keyof typeof GRADE_CONFIG] || GRADE_CONFIG.unknown
  const permLevel = cert.grade === 'healthy' ? 3 : cert.grade === 'unknown' ? 1 : 0

  const app = document.getElementById('app')!
  app.innerHTML = `
    <div class="status-card">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px">
        <span style="font-size:13px; font-weight:600">${cert.bot.name}</span>
        <span class="grade-badge ${grade.cssClass}">${grade.emoji} ${grade.label}</span>
      </div>
      <div class="field">
        <label>RIC ID</label>
        <value>${cert.id}</value>
      </div>
      <div class="field">
        <label>Developer</label>
        <value>${cert.developer.name} ${cert.developer.org ? `· ${cert.developer.org}` : ''}</value>
      </div>
      <div class="field">
        <label>Purpose</label>
        <value style="font-family:inherit; font-size:12px; color:#94a3b8">${cert.bot.purpose}</value>
      </div>
      <div class="permission-bar">
        <div class="label">Permission Level: ${permLevel}/5 — ${PERMISSION_LABELS[permLevel]}</div>
        <div class="levels">
          ${PERMISSION_LABELS.slice(1).map((_, i) =>
            `<div class="level-dot ${i + 1 <= permLevel ? 'active' : ''}"></div>`
          ).join('')}
        </div>
      </div>
    </div>
    <button class="btn-secondary" id="btn-refresh">Refresh Certificate</button>
  `

  document.getElementById('btn-refresh')?.addEventListener('click', () => {
    location.reload()
  })
}

async function init() {
  const status = await getStatus()

  if (!status.configured) return  // default HTML shows not-configured state

  const cert = status.ricId ? await fetchCert(status.ricId) : null
  if (cert) {
    renderConfigured(cert)
  }
}

document.addEventListener('DOMContentLoaded', init)
