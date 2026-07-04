interface FridayReminderData {
  userName: string
  incompleteItems: Array<{ section: string; remaining: number }>
  deadlineDate: string
  dashboardUrl: string
}

export function generateFridayReminderEmail(data: FridayReminderData): { subject: string; html: string } {
  const subject = `⏰ Friday Reminder — Activities Due by ${data.deadlineDate}`

  const rows = data.incompleteItems.map(item => `<tr>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0">${item.section}</td>
      <td style="padding:8px 12px;border-bottom:1px solid #f0f0f0;text-align:center;color:#ef4444;font-weight:600">${item.remaining}</td>
    </tr>`).join('')

  const html = `<!DOCTYPE html>
<html>
<body style="margin:0;padding:0;background:#f8fafc;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif">
  <div style="max-width:600px;margin:40px auto;background:#fff;border-radius:12px;overflow:hidden;box-shadow:0 1px 3px rgba(0,0,0,0.1)">
    <div style="background:#0F172A;padding:24px 32px">
      <h1 style="color:#fff;margin:0;font-size:20px;font-weight:700">Stratiq</h1>
      <p style="color:#94a3b8;margin:4px 0 0;font-size:13px">Friday Activity Reminder</p>
    </div>
    <div style="padding:32px">
      <p style="color:#374151;margin:0 0 16px">Hi ${data.userName},</p>
      <p style="color:#374151;margin:0 0 8px">This is your Friday reminder — the following activities are still incomplete and due by <strong>${data.deadlineDate}</strong>:</p>
      <p style="color:#6b7280;font-size:13px;margin:0 0 24px">Don't let the week close out with unfinished items. You've got this!</p>
      <table style="width:100%;border-collapse:collapse;margin-bottom:24px">
        <thead>
          <tr style="background:#f8fafc">
            <th style="padding:8px 12px;text-align:left;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Section</th>
            <th style="padding:8px 12px;text-align:center;font-size:12px;color:#6b7280;font-weight:600;text-transform:uppercase;letter-spacing:0.05em">Remaining</th>
          </tr>
        </thead>
        <tbody>${rows}</tbody>
      </table>
      <a href="${data.dashboardUrl}" style="display:inline-block;background:#0ea5e9;color:#fff;text-decoration:none;padding:12px 24px;border-radius:8px;font-weight:600;font-size:14px">Complete Your Activities →</a>
    </div>
    <div style="background:#f8fafc;padding:20px 32px;border-top:1px solid #e5e7eb">
      <p style="color:#9ca3af;font-size:12px;margin:0">Stratiq by Mindshare Consulting Inc. · You're receiving this because you're a member of the team.</p>
    </div>
  </div>
</body>
</html>`

  return { subject, html }
}
