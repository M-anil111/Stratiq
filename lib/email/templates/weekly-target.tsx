interface TargetData {
  userName: string
  weekOf: string
  targets: Array<{ section: string; target: number; done: number }>
  dashboardUrl: string
}

export function generateWeeklyTargetEmail(data: TargetData): { subject: string; html: string } {
  const subject = `Weekly Activity Targets — Week of ${data.weekOf}`

  const rows = data.targets.map(t => {
    const pct = t.target > 0 ? (t.done / t.target) * 100 : 100
    const status = pct >= 100 ? '✅' : pct >= 60 ? '⚠️' : '🔴'
    return `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${t.section}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${t.target}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${t.done}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center">${status}</td>
    </tr>`
  }).join('')

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0F172A;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Stratiq</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Weekly Activity Targets</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;margin:0 0 16px">Hi ${data.userName},</p>
      <p style="color:#374151;margin:0 0 24px">Here's your activity summary for the week of <strong>${data.weekOf}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Section</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Target</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Done</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Status</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${data.dashboardUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">View Your Targets →</a>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">Stratiq by Mindshare Consulting Inc. · You're receiving this because you're a member of the team.</p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
