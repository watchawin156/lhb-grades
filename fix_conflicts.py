filepath = r'c:\Users\pc wind\Documents\ระบบจัดการคะแนนนักเรียน\components\grading-system\grading-system.tsx'

with open(filepath, 'r', encoding='utf-8') as f:
    content = f.read()

# FIX: Standard Subject Modal header และ isAdminMode tab block (บรรทัด 2558-2596)
# ปัญหา:
# 1. line 2562: '</div>' ถูก close แต่ button X ยังอยู่ด้านนอก
# 2. line 2571: '{ isAdminMode && (' indent ผิด
# ต้องการโครงสร้างที่ถูกต้อง:
#   <div className="flex justify-between...">
#     <div>
#       <h3 ...>ตั้งค่าวิชามาตรฐาน</h3>
#       <p ...>...</p>
#     </div>
#     <button onClick=...><X size={24}/></button>
#   </div>
#   {isAdminMode && (
#     <div ...>
#       ...tabs...
#     </div>
#   )}

old_modal_block = '''            <div className="flex justify-between items-center mb-6 border-b border-slate-100 pb-4 shrink-0">
              <div>
                  <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ตั้งค่าวิชามาตรฐาน</h3>
                  <p className="text-sm text-slate-500 dark:text-slate-400">จัดการรายวิชาสำหรับทุกระดับชั้น หรือแก้ไขแม่แบบพื้นฐาน</p>
                </div>
                <button onClick={() => {
                  setIsStandardSubjectModalOpen(false);
                  setIsEditingTemplate(false);
                }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
    <X size={24} />
  </button>
              </div>

  { isAdminMode && (
    <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl mb-4 shrink-0">
      <button
        onClick={() => setIsEditingTemplate(false)}
        className={cn(
          "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
          !isEditingTemplate
            ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400"
        )}
      >
        จัดการวิชาในเทอมนี้
      </button>
      <button
        onClick={() => setIsEditingTemplate(true)}
        className={cn(
          "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
          isEditingTemplate
            ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
            : "text-slate-500 dark:text-slate-400"
        )}
      >
        แก้ไขแม่แบบ (Standard Template)
            </button>
          </div>
              )}'''

new_modal_block = '''            <div className="flex justify-between items-center mb-6 border-b border-slate-100 dark:border-slate-700 pb-4 shrink-0">
              <div>
                <h3 className="text-xl font-bold text-slate-800 dark:text-slate-100">ตั้งค่าวิชามาตรฐาน</h3>
                <p className="text-sm text-slate-500 dark:text-slate-400">จัดการรายวิชาสำหรับทุกระดับชั้น หรือแก้ไขแม่แบบพื้นฐาน</p>
              </div>
              <button onClick={() => {
                setIsStandardSubjectModalOpen(false);
                setIsEditingTemplate(false);
              }} className="text-slate-400 hover:text-slate-600 dark:hover:text-slate-200">
                <X size={24} />
              </button>
            </div>

            {isAdminMode && (
              <div className="flex bg-slate-100 dark:bg-slate-900/50 p-1 rounded-xl mb-4 shrink-0">
                <button
                  onClick={() => setIsEditingTemplate(false)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    !isEditingTemplate
                      ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  จัดการวิชาในเทอมนี้
                </button>
                <button
                  onClick={() => setIsEditingTemplate(true)}
                  className={cn(
                    "flex-1 py-1.5 rounded-lg text-xs font-bold transition-all",
                    isEditingTemplate
                      ? "bg-white dark:bg-slate-800 text-slate-800 dark:text-slate-100 shadow-sm"
                      : "text-slate-500 dark:text-slate-400"
                  )}
                >
                  แก้ไขแม่แบบ (Standard Template)
                </button>
              </div>
            )}'''

if old_modal_block in content:
    content = content.replace(old_modal_block, new_modal_block, 1)
    print("FIX: Standard Subject Modal header & tabs block fixed")
else:
    print("FAIL: Standard Subject Modal block not found")
    # ลองหา partial
    parts = [
        'setIsEditingTemplate(false);\n                }} className="text-slate-400',
        '{ isAdminMode && (\n    <div className="flex bg-slate-100',
        '      >\n        แก้ไขแม่แบบ (Standard Template)\n            </button>',
    ]
    for p in parts:
        if p in content:
            print(f"  Found partial: {repr(p[:50])}")
        else:
            print(f"  NOT found: {repr(p[:50])}")

with open(filepath, 'w', encoding='utf-8') as f:
    f.write(content)

print("Done")
