import { headers } from 'next/headers'
import RefererClient from './RefererClient'

export default async function RefererPage() {
  const headersList = await headers()
  const serverReferer = headersList.get('referer')

  return (
    <div style={{ padding: '2rem', fontFamily: 'system-ui' }}>
      <h1>页面来源</h1>
      <p>
        <strong>服务端 Referer:</strong>{' '}
        {serverReferer || '无（客户端导航或直接访问）'}
      </p>
      <RefererClient />
    </div>
  )
}
