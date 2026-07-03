interface MissedTargetData {
  managerName: string
  weekOf: string
  members: Array<{ name: string; section: string; target: number; done: number; pct: number }>
  dashboardUrl: string
}

export function generateMissedTargetEmail(data: MissedTargetData): { subject: string; html: string } {
  const subject = `⚠️ Missed Targets — Week of ${data.weekOf}`

  const rows = data.members.map(m => `
    <tr style="border-bottom:1px solid #f0f0f0">
      <td style="padding:8px 12px;font-size:13px;color:#111827">${m.name}</td>
      <td style="padding:8px 12px;font-size:13px;color:#374151">${m.section}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:center">${m.done}/${m.target}</td>
      <td style="padding:8px 12px;font-size:13px;text-align:center;font-weight:600;color:${m.pct >= 60 ? '#d97706' : '#dc2626'}">${m.pct}%</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0F172A;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Stratiq</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Activity Alert</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;margin:0 0 8px">Hi ${data.managerName},</p>
      <p style="color:#374151;margin:0 0 24px">The following team members missed their targets for the week of <strong>${data.weekOf}</strong>:</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Member</th>
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Section</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">Progress</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase">%</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${data.dashboardUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">View Team Dashboard →</a>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">Stratiq by Mindshare Consulting Inc.</p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
