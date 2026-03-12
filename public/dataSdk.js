/**
 * dataSdk.js - Bridge between the new UI and old API
 * This version supports both loading and saving to D1 via /api/data
 */
window.dataSdk = {
  onDataChanged: null,
  cachedData: [], // This will hold the flat array from the new UI
  
  // Internal mapping to original IDs from D1
  idMap: {
    students: {}, // student_code -> id
    subjects: {}  // subject_code -> id
  },

  init: async function(options) {
    this.onDataChanged = options.onDataChanged;
    await this.loadData();
  },

  loadData: async function() {
    try {
      const response = await fetch('/api/data');
      if (response.ok) {
        const cloudData = await response.json();
        const flattened = [];
        
        // Reset ID Maps
        this.idMap.students = {};
        this.idMap.subjects = {};

        // 1. Students
        if (cloudData.students) {
          cloudData.students.forEach(s => {
            // Filter out Nursery/Kindergarten
            if (s.class && (s.class.startsWith('อ.') || s.class.includes('อนุบาล'))) {
              return;
            }
            
            this.idMap.students[s.code] = s.id;
            flattened.push({
              type: 'student',
              student_code: s.code,
              student_name: s.name,
              class_level: s.class,
              year: Number(s.year),
              order_index: parseInt(s.number) || 0,
              status: s.status || 'ปกติ'
            });
          });
        }
        
        // 2. Subjects
        if (cloudData.subjects) {
          cloudData.subjects.forEach(s => {
            // สำคัญ: ใน D1 ใช้ 'code' และ 'name' แต่ใน FE เราใช้ 'subject_code' และ 'subject_name'
            const sCode = s.subject_code || s.code;
            const sName = s.subject_name || s.name;
            const sMax = s.max_score || s.maxScore || 100;
            
            this.idMap.subjects[sCode] = s.id;
            
            if (s.class_level) {
              flattened.push({
                ...s,
                type: 'subject',
                subject_code: sCode,
                subject_name: sName,
                class_level: s.class_level,
                max_score: sMax,
                year: (s.year === null || s.year === undefined) ? 0 : Number(s.year)
              });
            } else {
              const uniqueClasses = [...new Set(cloudData.students.map(st => st.class))];
              uniqueClasses.forEach(cls => {
                flattened.push({
                  ...s,
                  type: 'subject',
                  subject_code: sCode,
                  subject_name: sName,
                  class_level: cls,
                  max_score: sMax,
                  year: (s.year === null || s.year === undefined) ? 0 : Number(s.year)
                });
              });
            }
          });
        }

        // 3. Scores
        if (cloudData.scores) {
          cloudData.scores.forEach(s => {
            const studentCode = cloudData.students.find(st => st.id === s.studentId)?.code;
            // แมป Subject Code จาก ID (ในกรณีที่ API ส่งแค่ ID มา) หรือใช้รหัสที่แมปไว้
            const subjectObj = cloudData.subjects.find(sub => sub.id === s.subjectId);
            const subjectCode = subjectObj ? (subjectObj.subject_code || subjectObj.code) : null;
            const studentClass = cloudData.students.find(st => st.id === s.studentId)?.class;

            if (studentCode && subjectCode) {
              if (s.score1 !== undefined && s.score1 !== null) {
                flattened.push({
                  type: 'score',
                  student_code: studentCode,
                  subject_code: subjectCode,
                  class_level: studentClass,
                  score: s.score1,
                  semester: 1,
                  year: Number(s.year)
                });
              }
              if (s.score2 !== undefined && s.score2 !== null) {
                flattened.push({
                  type: 'score',
                  student_code: studentCode,
                  subject_code: subjectCode,
                  class_level: studentClass,
                  score: s.score2,
                  semester: 2,
                  year: Number(s.year)
                });
              }
            }
          });
        }

        this.cachedData = flattened;
        if (this.onDataChanged) this.onDataChanged(flattened);
      }
    } catch (e) {
      console.error("SDK Load Error:", e);
    }
  },

  create: function(item) {
    this.updateLocalAndSync(item);
  },

  update: function(item) {
    this.updateLocalAndSync(item);
  },

  updateLocalAndSync: function(item) {
    // Find and update item in cachedData
    const idx = this.cachedData.findIndex(d => 
      d.type === item.type && 
      (item.type === 'score' ? 
        (d.student_code === item.student_code && d.subject_code === item.subject_code && d.semester === item.semester && d.year === item.year) : 
        (d.student_code === item.student_code || d.subject_code === item.subject_code)
      )
    );

    if (idx >= 0) {
      this.cachedData[idx] = { ...this.cachedData[idx], ...item };
    } else {
      this.cachedData.push(item);
    }

    this.debouncedSync();
  },

  // New method to sync the entire state at once
  syncAll: function(allData) {
    this.cachedData = [...allData];
    this.debouncedSync();
  },

  timer: null,
  debouncedSync: function() {
    if (this.timer) clearTimeout(this.timer);
    this.timer = setTimeout(() => this.performFullSync(), 2000);
  },

  performFullSync: async function() {
    const students = [];
    const subjects = [];
    const scoresMap = {}; // studentId-subjectId-year -> { studentId, subjectId, year, score1, score2 }

    this.cachedData.forEach(d => {
      if (d.type === 'student') {
        students.push({
          id: this.idMap.students[d.student_code] || `std-${Date.now()}-${Math.random()}`,
          code: d.student_code,
          name: d.student_name,
          class: d.class_level,
          number: d.order_index?.toString(),
          year: d.year,
          status: d.status || 'ปกติ'
        });
      } else if (d.type === 'subject') {
        // Subjects are deduplicated by code
        if (!subjects.find(s => s.code === d.subject_code)) {
          subjects.push({
            id: this.idMap.subjects[d.subject_code] || `subj-${Date.now()}-${Math.random()}`,
            code: d.subject_code,
            name: d.subject_name,
            class_level: d.class_level,
            maxScore: d.max_score,
            year: (!d.year || d.year === 0) ? null : Number(d.year),
            // API handles semester inside scores
            type: d.subject_name.includes('เพิ่มเติม') ? 'เพิ่มเติม' : 'พื้นฐาน',
            credit: 1
          });
        }
      } else if (d.type === 'score') {
        const studentId = this.idMap.students[d.student_code];
        const subjectId = this.idMap.subjects[d.subject_code];
        if (studentId && subjectId) {
          const key = `${studentId}-${subjectId}-${d.year}`;
          if (!scoresMap[key]) {
            scoresMap[key] = { studentId, subjectId, year: d.year };
          }
          if (d.semester === 1) scoresMap[key].score1 = d.score;
          if (d.semester === 2) scoresMap[key].score2 = d.score;
        }
      }
    });

    try {
      await fetch('/api/data', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          students, 
          subjects, 
          scores: Object.values(scoresMap) 
        }),
      });
      console.log("SDK Sync Complete");
    } catch (e) {
      console.error("SDK Sync Error:", e);
    }
  }
};
