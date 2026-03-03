-- Students Table
CREATE TABLE IF NOT EXISTS students (
    id TEXT PRIMARY KEY,
    studentId TEXT NOT NULL,
    name TEXT NOT NULL,
    room TEXT NOT NULL,
    number TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Subjects Table
CREATE TABLE IF NOT EXISTS subjects (
    id TEXT PRIMARY KEY,
    code TEXT NOT NULL,
    name TEXT NOT NULL,
    maxScore INTEGER DEFAULT 100,
    semester INTEGER DEFAULT 1,
    type TEXT DEFAULT 'พื้นฐาน',
    credit REAL DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Scores Table
CREATE TABLE IF NOT EXISTS scores (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    student_internal_id TEXT NOT NULL, -- ref students.id
    subject_internal_id TEXT NOT NULL, -- ref subjects.id
    score REAL DEFAULT 0,
    academic_year INTEGER NOT NULL,
    semester INTEGER DEFAULT 1,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    UNIQUE(student_internal_id, subject_internal_id, academic_year, semester)
);

-- Create some indexes for performance
CREATE INDEX IF NOT EXISTS idx_students_room ON students(room);
CREATE INDEX IF NOT EXISTS idx_scores_lookup ON scores(student_internal_id, subject_internal_id, academic_year, semester);
