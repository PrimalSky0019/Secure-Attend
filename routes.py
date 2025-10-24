# Authentication Routes
@app.route('/api/login', methods=['POST'])
def login():
    data = request.json
    email = data.get('email')
    password = data.get('password')

    # Check credentials (this should be replaced with a proper database check)
    if email in users and users[email]['password'] == password:
        token = generate_token(email)
        return jsonify({
            'status': 'success',
            'token': token,
            'role': users[email]['role']
        })
    
    return jsonify({
        'status': 'error',
        'message': 'Invalid credentials'
    }), 401

@app.route('/api/courses', methods=['GET'])
@auth_required
def get_courses():
    # This should be fetched from a database
    return jsonify([
        {
            'code': 'CS101',
            'name': 'Introduction to Programming',
            'venue': 'Room 101',
            'faculty': 'Dr. Smith'
        },
        {
            'code': 'CS102',
            'name': 'Data Structures',
            'venue': 'Room 102',
            'faculty': 'Dr. Johnson'
        }
    ])

@app.route('/api/export-attendance', methods=['POST'])
@auth_required
def export_attendance():
    data = request.json
    course_code = data.get('course_code')
    date = data.get('date')

    attendance = load_attendance()
    course_attendance = attendance.get(date, {})

    # Create Excel file
    wb = Workbook()
    ws = wb.active
    ws.title = f"Attendance_{course_code}"

    # Headers
    headers = ['Registration No', 'Name', 'Course', 'Time', 'Status']
    for col, header in enumerate(headers, start=1):
        ws.cell(row=1, column=col, value=header)

    # Data
    row = 2
    for name, times in course_attendance.items():
        student = students.get(name, {})
        for time in times:
            ws.cell(row=row, column=1, value=student.get('reg_no', ''))
            ws.cell(row=row, column=2, value=name)
            ws.cell(row=row, column=3, value=course_code)
            ws.cell(row=row, column=4, value=time)
            ws.cell(row=row, column=5, value='Present')
            row += 1

    # Save to BytesIO
    excel_file = BytesIO()
    wb.save(excel_file)
    excel_file.seek(0)

    return send_file(
        excel_file,
        mimetype='application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        as_attachment=True,
        download_name=f'attendance_{course_code}_{date}.xlsx'
    )

@app.route('/api/add-student', methods=['POST'])
@auth_required
def add_student():
    data = request.json
    reg_no = data.get('reg_no')
    name = data.get('name')
    course = data.get('course')
    image = data.get('image')

    if not all([reg_no, name, course, image]):
        return jsonify({
            'status': 'error',
            'message': 'All fields are required'
        }), 400

    try:
        # Process face
        img = base64_to_cv_image(image)
        faces = find_faces(img)
        
        if not faces:
            return jsonify({
                'status': 'error',
                'message': 'No face detected in image'
            }), 400
            
        if len(faces) > 1:
            return jsonify({
                'status': 'error',
                'message': 'Multiple faces detected'
            }), 400

        embeddings = get_face_embeddings(img, faces)
        if not embeddings:
            return jsonify({
                'status': 'error',
                'message': 'Could not process face'
            }), 400

        # Save student data
        students[reg_no] = {
            'name': name,
            'course': course,
            'reg_no': reg_no
        }

        # Save face embedding
        db = load_database()
        db[name] = embeddings[0]
        save_database(db)

        return jsonify({
            'status': 'success',
            'message': 'Student added successfully'
        })

    except Exception as e:
        return jsonify({
            'status': 'error',
            'message': str(e)
        }), 500