export const onRequest = async (context: any) => {
    const { request } = context;
    const BOT_TOKEN = '8505492579:AAHWRjIcdINKMetnp1bKcXt0xecVSoChSr8';
    const CHAT_ID = '-1003201809285';
    const MESSAGE_THREAD_ID = 7900;
    const TG_API = `https://api.telegram.org/bot${BOT_TOKEN}`;

    if (request.method === "POST") {
        try {
            const body = await request.json() as any;
            const { students, subjects, scores, academicYear } = body;

            const backupData = {
                version: 1,
                timestamp: new Date().toISOString(),
                academicYear,
                students,
                subjects,
                scores,
            };

            const jsonStr = JSON.stringify(backupData, null, 2);
            const blob = new Blob([jsonStr], { type: 'application/json' });

            const formData = new FormData();
            formData.append('chat_id', CHAT_ID);
            formData.append('message_thread_id', String(MESSAGE_THREAD_ID));
            formData.append('document', blob, `backup_${academicYear}_${new Date().toISOString().replace(/[:.]/g, '-')}.json`);
            formData.append('caption', `📦 สำรองข้อมูลอัตโนมัติ | ปีการศึกษา ${academicYear} | นักเรียน ${students.length} คน | วิชา ${subjects.length} รายวิชา | ${new Date().toLocaleString('th-TH')}`);

            const tgRes = await fetch(`${TG_API}/sendDocument`, {
                method: 'POST',
                body: formData,
            });

            if (!tgRes.ok) {
                const err = await tgRes.json();
                return Response.json({ ok: false, error: err }, { status: 502 });
            }

            const result = await tgRes.json() as any;
            return Response.json({ ok: true, messageId: result.result?.message_id });
        } catch (e: any) {
            return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
    }

    if (request.method === "GET") {
        try {
            const res = await fetch(
                `${TG_API}/getUpdates?limit=100&timeout=0`,
                { cache: 'no-store' }
            );

            if (!res.ok) {
                return Response.json({ ok: false, error: 'Failed to get updates' }, { status: 502 });
            }

            const data = await res.json() as any;
            const updates: any[] = data.result || [];

            let latestDoc: any = null;
            for (let i = updates.length - 1; i >= 0; i--) {
                const msg = updates[i].message || updates[i].channel_post;
                if (!msg) continue;
                const matchChat = String(msg.chat?.id) === CHAT_ID;
                const matchThread = msg.message_thread_id === MESSAGE_THREAD_ID;
                if (matchChat && matchThread && msg.document) {
                    latestDoc = msg.document;
                    break;
                }
            }

            if (!latestDoc) {
                return Response.json({ ok: false, error: 'ไม่พบ backup ใน Telegram' }, { status: 404 });
            }

            const fileRes = await fetch(`${TG_API}/getFile?file_id=${latestDoc.file_id}`);
            const fileData = await fileRes.json() as any;
            const filePath = fileData.result?.file_path;
            if (!filePath) {
                return Response.json({ ok: false, error: 'ไม่สามารถดึงไฟล์ได้' }, { status: 502 });
            }

            const downloadRes = await fetch(`https://api.telegram.org/file/bot${BOT_TOKEN}/${filePath}`);
            const json = await downloadRes.json();

            return Response.json({ ok: true, data: json });
        } catch (e: any) {
            return Response.json({ ok: false, error: e.message }, { status: 500 });
        }
    }

    return Response.json({ error: "Method Not Allowed" }, { status: 405 });
};
