'use client'

import { useEffect, useState } from 'react'

export default function RefererClient() {
    const [referer, setReferer] = useState<string>('')

    useEffect(() => {
        setReferer(document.referrer)
    }, [])

    return (
        <p>
            <strong>客户端 Referrer:</strong>{' '}
            {referer || '无（直接访问或来源被隐藏）'}
        </p>
    )
}

