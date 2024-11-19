use dacs3v0;

DROP PROCEDURE IF EXISTS signup;
DROP PROCEDURE IF EXISTS signup_n_add_student_to_class;
DROP PROCEDURE IF EXISTS login;
DROP PROCEDURE IF EXISTS create_class;
DROP PROCEDURE IF EXISTS update_class_name;
DROP PROCEDURE IF EXISTS attach_file_to_class;
DROP PROCEDURE IF EXISTS remove_attach_file_from_class;
DROP PROCEDURE IF EXISTS check_access_to_class;
DROP PROCEDURE IF EXISTS get_class_members;
DROP PROCEDURE IF EXISTS get_class_attach_files;
DROP PROCEDURE IF EXISTS get_all_classes;
DROP PROCEDURE IF EXISTS get_all_student_of_class;
DROP PROCEDURE IF EXISTS create_doc_category;
DROP PROCEDURE IF EXISTS create_doc_n_add_to_doc_category;
DROP PROCEDURE IF EXISTS get_all_doc_category_n_doc;
DROP PROCEDURE IF EXISTS get_all_doc_by_doc_category_id;
DROP PROCEDURE IF EXISTS update_doc_category_name;
DROP PROCEDURE IF EXISTS delete_doc_category;
DROP PROCEDURE IF EXISTS delete_doc;
DROP PROCEDURE IF EXISTS create_quest_category;
DROP PROCEDURE IF EXISTS get_all_quest_category;
DROP PROCEDURE IF EXISTS create_quest_n_add_to_quest_category;
DROP PROCEDURE IF EXISTS check_answer;
DROP PROCEDURE IF EXISTS get_all_quest_n_answers_by_quest_category_id;
DROP PROCEDURE IF EXISTS update_quest_category_name;
DROP PROCEDURE IF EXISTS delete_quest_category;
DROP PROCEDURE IF EXISTS update_quest;
DROP PROCEDURE IF EXISTS delete_quest;
DROP PROCEDURE IF EXISTS create_exercise;
DROP PROCEDURE IF EXISTS attach_file_to_exercise;
DROP PROCEDURE IF EXISTS submit_exercise;
DROP PROCEDURE IF EXISTS attach_file_to_submitted_exercise;
DROP PROCEDURE IF EXISTS create_test;
DROP PROCEDURE IF EXISTS get_all_questions_in_test;
DROP PROCEDURE IF EXISTS submit_test;
DROP PROCEDURE IF EXISTS attach_quest_to_submit_test;
DROP PROCEDURE IF EXISTS mark;
DROP PROCEDURE IF EXISTS check_class_existence;
DROP PROCEDURE IF EXISTS get_all_lecturer_classes;
DROP PROCEDURE IF EXISTS get_all_student_classes;
DROP PROCEDURE IF EXISTS get_exercise_ids;
DROP PROCEDURE IF EXISTS get_lecturer_exercise_info;
DROP PROCEDURE IF EXISTS get_exercise_attach_files;
DROP PROCEDURE IF EXISTS delete_exercise;
DROP PROCEDURE IF EXISTS get_submitted_exercise_files;
DROP PROCEDURE IF EXISTS get_all_submitted_exercise_files;
DROP PROCEDURE IF EXISTS update_exercise;
DROP PROCEDURE IF EXISTS reset_exercise_attach_file;
DROP PROCEDURE IF EXISTS get_exercise_info_for_student;
DROP PROCEDURE IF EXISTS get_or_create_n_get_submitted_exercise_id;
DROP PROCEDURE IF EXISTS delete_submitted_exercise_attach_file;
DROP PROCEDURE IF EXISTS unsubmit_exercise;
DROP PROCEDURE IF EXISTS get_students_submission_status;
DROP PROCEDURE IF EXISTS get_students_submission_status_with_files;

DELIMITER $
-- signup (is_lecturer, user_name, user_login_name, user_password) **used
CREATE PROCEDURE signup(
	in is_lecturer tinyint,
    in user_name nvarchar(50),
    in user_login_name varchar(100),
    in user_password varchar(100),
    out student_id int
) BEGIN
    DECLARE inserted_id int;
    DECLARE existing_login_id varchar(100);
    DECLARE should_exit BOOLEAN DEFAULT FALSE;
	DECLARE is_email BOOLEAN DEFAULT FALSE;
    DECLARE is_phone BOOLEAN DEFAULT FALSE;

    -- Kiểm tra xem login_id đã tồn tại chưa
    SELECT login_id INTO existing_login_id FROM user_login_id WHERE login_id = user_login_name LIMIT 1;

    -- Nếu login_id đã tồn tại, thông báo lỗi và cập nhật biến should_exit
    IF existing_login_id IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Tên đăng nhập đã tồn tại';
        SET should_exit = TRUE;
    END IF;

    IF should_exit = FALSE THEN
        SET is_email = user_login_name REGEXP '^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\\.[a-zA-Z]{2,4}$';
        SET is_phone = user_login_name REGEXP '^[0-9]{10,15}$';

        IF is_lecturer = 1 THEN
            BEGIN
                INSERT INTO users(is_lecturer, name, password) VALUES (is_lecturer, user_name, user_password);
                SET inserted_id = last_insert_id();

                IF is_email THEN
                    UPDATE users SET email = user_login_name WHERE id = inserted_id;
                ELSEIF is_phone THEN
                    UPDATE users SET phone_number = user_login_name WHERE id = inserted_id;
                END IF;
                
                INSERT INTO user_login_id(user_id, login_id) VALUES (inserted_id, user_login_name);
                INSERT INTO lecturers(id) VALUES (inserted_id);
            END;
        ELSE
            BEGIN
                INSERT INTO users(name, password) VALUES (user_name, user_password);
                SET inserted_id = last_insert_id();
                SET student_id = last_insert_id();

                IF is_email THEN
                    UPDATE users SET email = user_login_name WHERE id = inserted_id;
                ELSEIF is_phone THEN
                    UPDATE users SET phone_number = user_login_name WHERE id = inserted_id;
                END IF;

                INSERT INTO user_login_id(user_id, login_id) VALUES (inserted_id, user_login_name);
                INSERT INTO students(id) VALUES (inserted_id);
            END;
        END IF;
    END IF;
END $

-- signup_n_add_student_to_class (user_name, user_login_name, user_password, class_id) **used
CREATE PROCEDURE signup_n_add_student_to_class(
    in user_name nvarchar(50),
    in user_login_name varchar(100), 
    in user_password varchar(100),
    in class_id int
) BEGIN
    DECLARE student_id_out INT;
    DECLARE existing_student_id INT;
    DECLARE existing_student_in_class INT;
    DECLARE is_account_exists BOOLEAN DEFAULT FALSE;

    -- Kiểm tra xem login_id đã tồn tại chưa
    SELECT user_id INTO existing_student_id FROM user_login_id 
    WHERE login_id = user_login_name LIMIT 1;

    -- Nếu sinh viên đã có tài khoản, kiểm tra xem sinh viên đã có trong lớp chưa
    IF existing_student_id IS NOT NULL THEN
        SELECT student_id INTO existing_student_in_class FROM classes_n_students 
        WHERE student_id = existing_student_id AND classes_n_students.class_id = class_id LIMIT 1;
    END IF;

    -- Nếu sinh viên đã tồn tại và đã có trong lớp, thông báo lỗi
    IF existing_student_in_class IS NOT NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sinh viên đã có mặt trong lớp';
    ELSE
        -- Nếu sinh viên chưa có trong lớp, thêm vào lớp
        -- Nếu chưa có tài khoản, tạo tài khoản | Nếu đã có tài khoản, đánh dấu
        IF existing_student_id IS NULL THEN
            CALL signup(0, user_name, user_login_name, user_password, student_id_out);
        ELSE
            SET student_id_out = existing_student_id;
            SET is_account_exists = TRUE;
        END IF;

        -- Thêm sinh viên vào lớp
        INSERT INTO classes_n_students(student_id, class_id) VALUES (student_id_out, class_id);
    END IF;

    IF is_account_exists = TRUE THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Sinh viên đã có tài khoản từ trước';
    END IF;
END $

-- login (user_login_name) **used
create procedure login(
    in user_login_name nvarchar(100)
) begin
    SELECT u.id, u.is_lecturer, u.name, u.phone_number, u.email, ul.login_id as user_login_id, u.password
	FROM users u
	JOIN user_login_id ul ON u.id = ul.user_id
    WHERE ul.login_id = user_login_name;
end $

-- create_class (lecturer_id, class_name) **used
create procedure create_class(
    in lecturer_id int,
    in class_name nvarchar(50)
) begin
    INSERT INTO classes(name, lecturer_id) VALUES (class_name, lecturer_id);
    
    SELECT id, name
    FROM classes
    WHERE id = LAST_INSERT_ID();
end $

-- update_class_name (class_id, new_name) **used
create procedure update_class_name(
    in class_id int,
    in new_name nvarchar(50)
) begin
    UPDATE classes
    SET name = new_name
    WHERE id = class_id;
end $

-- attach_file_to_class (class_id, doc_id) **used
CREATE PROCEDURE attach_file_to_class(
    IN class_id INT,
    IN doc_id INT
)BEGIN
    INSERT INTO class_attach_files (class_id, doc_id)
    VALUES (class_id, doc_id);
END$

-- remove_attach_file_from_class (class_id, doc_id) **used
CREATE PROCEDURE remove_attach_file_from_class(
    in class_id int,
    in doc_id int
)BEGIN
    DELETE FROM class_attach_files WHERE class_attach_files.class_id = class_id AND class_attach_files.doc_id = doc_id;
END$

-- check_class_existence (class_id) **used
CREATE PROCEDURE check_class_existence(
    IN class_id INT
) BEGIN
    -- Kiểm tra xem lớp có tồn tại không và nếu không tồn tại, ném ra lỗi
    IF NOT EXISTS (SELECT 1 FROM classes WHERE id = class_id) THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Lớp không tồn tại.';
    END IF;
END $

-- check_access_to_class (user_id, class_id) **used
CREATE PROCEDURE check_access_to_class(
    in user_id int,
    in class_id int
)BEGIN
    DECLARE is_lecturer int;
    DECLARE is_student int;

    -- Kiểm tra xem user_id là giáo viên hay sinh viên
    SELECT COUNT(*) INTO is_lecturer FROM lecturers WHERE id = user_id;
    SELECT COUNT(*) INTO is_student FROM students WHERE id = user_id;

    -- Kiểm tra xem user_id có phải là giảng viên của lớp không
    IF is_lecturer > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM classes WHERE id = class_id AND lecturer_id = user_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không phải là giảng viên của lớp.';
        END IF;
    END IF;

    -- Kiểm tra xem user_id có phải là sinh viên của lớp không
    IF is_student > 0 THEN
        IF NOT EXISTS (SELECT 1 FROM classes_n_students WHERE class_id = class_id AND student_id = user_id) THEN
            SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Không phải là sinh viên của lớp.';
        END IF;
    END IF;
END$

-- get_class_members(class_id) **used (Actualy get class name and number of members)
CREATE PROCEDURE get_class_members(
    IN class_id INT
)BEGIN
    SELECT c.name AS class_name, COUNT(cs.student_id) AS member_count
    FROM classes c
    LEFT JOIN classes_n_students cs ON c.id = cs.class_id
    WHERE c.id = class_id
    GROUP BY c.id;
END $

-- get_class_attach_files (class_id, lecturer_id) **used
CREATE PROCEDURE get_class_attach_files(
    IN class_id INT,
    IN lecturer_id INT
)BEGIN
    SELECT caf.doc_id, d.file_name, dc.name AS category_name
    FROM class_attach_files caf
    INNER JOIN docs d ON caf.doc_id = d.id
    INNER JOIN doc_categories dc ON d.doc_category_id = dc.id
    WHERE caf.class_id = class_id
    AND EXISTS (
        SELECT 1
        FROM classes c
        WHERE c.id = caf.class_id
        AND c.lecturer_id = lecturer_id
    );
END $

-- delete_class (class_id, lecturer_id) *nợ, dữ liệu liên quan quá nhiều, xử lý sau.

-- get_all_lecturer_classes (lecturer_id) **used
create procedure get_all_lecturer_classes(
    in lecturer_id int
) begin
    SELECT c.id, c.name
    FROM classes c
    JOIN lecturers l ON c.lecturer_id = l.id
    WHERE l.id = lecturer_id;
end $

-- get_all_student_classes (student_id) **used
CREATE PROCEDURE get_all_student_classes(
    in student_id int
)BEGIN
    SELECT classes.id, classes.name, lecturers.id AS lecturer_id, users.name AS lecturer_name
    FROM classes
    INNER JOIN classes_n_students ON classes.id = classes_n_students.class_id
    INNER JOIN lecturers ON classes.lecturer_id = lecturers.id
    INNER JOIN users ON users.id = lecturers.id
    WHERE classes_n_students.student_id = student_id;
END $

-- get_all_student_of_class (class_id) **used
CREATE PROCEDURE get_all_student_of_class(
    IN class_id INT
) BEGIN
    SELECT u.id, ul1.login_id, u.name
    FROM users u
    JOIN students s ON u.id = s.id
    JOIN classes_n_students cs ON s.id = cs.student_id
    JOIN classes c ON cs.class_id = c.id
    JOIN (
        SELECT user_id, MIN(id) AS min_id
        FROM user_login_id
        GROUP BY user_id
    ) AS sub_ul ON u.id = sub_ul.user_id
    JOIN user_login_id ul1 ON sub_ul.user_id = ul1.user_id AND sub_ul.min_id = ul1.id
    WHERE c.id = class_id
    ORDER BY ul1.login_id ASC;
END $

-- create_doc_category (lecturer_id, category_name) **used
create procedure create_doc_category(
    in lecturer_id int,
    in category_name nvarchar(50)
) begin
    INSERT INTO doc_categories(name, lecturer_id) VALUES(category_name, lecturer_id);

    SELECT id, name
    FROM doc_categories
    WHERE id = LAST_INSERT_ID();
end $

-- create_doc_n_add_to_doc_category (file_name, doc_category_id) **used
create procedure create_doc_n_add_to_doc_category(
    in file_name TEXT,
    in doc_category_id int
) begin
    INSERT INTO docs (file_name, doc_category_id) VALUES(file_name, doc_category_id);
    SELECT id, file_name FROM docs WHERE id = last_insert_id();
end $

-- get_all_doc_category_n_doc (lecturer_id) **used
CREATE PROCEDURE get_all_doc_category_n_doc(
    IN lecturer_id INT
) BEGIN
    SELECT d.id AS doc_id, d.file_name, dc.id AS doc_category_id, dc.name AS category_name
    FROM doc_categories dc
    LEFT JOIN docs d ON d.doc_category_id = dc.id
    WHERE dc.lecturer_id = lecturer_id;
END $

-- get_all_doc_by_doc_category_id (doc_category_id) **used
CREATE PROCEDURE get_all_doc_by_doc_category_id(
    IN doc_category_id INT
) BEGIN
    SELECT d.id AS doc_id, d.file_name
    FROM docs d
    WHERE d.doc_category_id = doc_category_id;
END $

-- update_doc_category_name(doc_category_id, new_name) **used
CREATE PROCEDURE update_doc_category_name(
    IN doc_category_id INT,
    IN new_name NVARCHAR(50)
) BEGIN
    UPDATE doc_categories
    SET name = new_name
    WHERE id = doc_category_id;
END $

-- delete_doc_category(doc_category_id) **used
CREATE PROCEDURE delete_doc_category(
    IN doc_category_id INT
)
BEGIN
    -- Xóa tất cả các file đính kèm của danh mục tài liệu đó trong các lớp
    DELETE caf FROM class_attach_files caf
    INNER JOIN docs d ON caf.doc_id = d.id
    WHERE d.doc_category_id = doc_category_id;

    -- Xóa tất cả các file đính kèm của danh mục tài liệu đó trong các bài tập
    DELETE eaf FROM exercise_attach_files eaf
    INNER JOIN docs d ON eaf.doc_id = d.id
    WHERE d.doc_category_id = doc_category_id;

    -- Xóa tất cả các tài liệu thuộc danh mục đó
    DELETE FROM docs WHERE docs.doc_category_id = doc_category_id;

    -- Xóa danh mục tài liệu
    DELETE FROM doc_categories WHERE id = doc_category_id;
END $

-- delete_doc(doc_id) **used
CREATE PROCEDURE delete_doc(
    IN doc_id INT
)BEGIN
    -- Xóa file đính kèm trong các lớp
    DELETE FROM class_attach_files WHERE class_attach_files.doc_id = doc_id;
    -- Xóa file đính kèm trong các bài tập
    DELETE FROM exercise_attach_files WHERE exercise_attach_files.doc_id = doc_id;
    -- Xóa tài liệu
    DELETE FROM docs WHERE id = doc_id;
END $

-- create_quest_category (lecturer_id, category_name)
CREATE PROCEDURE create_quest_category(
    IN lecturer_id INT,
    IN category_name NVARCHAR(50)
)BEGIN
    INSERT INTO quest_categories(name, lecturer_id)
    VALUES (category_name, lecturer_id);
END $

-- create_quest_n_add_to_quest_category (quest_category_id, quest_content, option1_content, option2_content, option3_content, option4_content, correct_option)
CREATE PROCEDURE create_quest_n_add_to_quest_category(
    IN quest_category_id INT,
    IN quest_content TEXT,
    IN option1_content TEXT,
    IN option2_content TEXT,
    IN option3_content TEXT,
    IN option4_content TEXT,
    IN correct_option TINYINT
)BEGIN
    DECLARE quest_id INT;

    -- Tạo quest mới và lấy id của quest vừa tạo
    INSERT INTO quests(content, quest_category_id)
    VALUES (quest_content, quest_category_id);
    SET quest_id = LAST_INSERT_ID();

    -- Thêm các lựa chọn cho quest
    INSERT INTO quest_options(content, is_right, quest_id)
    VALUES 
        (option1_content, CASE WHEN correct_option = 1 THEN 1 ELSE 0 END, quest_id),
        (option2_content, CASE WHEN correct_option = 2 THEN 1 ELSE 0 END, quest_id),
        (option3_content, CASE WHEN correct_option = 3 THEN 1 ELSE 0 END, quest_id),
        (option4_content, CASE WHEN correct_option = 4 THEN 1 ELSE 0 END, quest_id);
END $

-- get_all_quest_category (lecturer_id)
CREATE PROCEDURE get_all_quest_category(
    IN lecturer_id INT
)BEGIN
    SELECT id, name
    FROM quest_categories
    WHERE quest_categories.lecturer_id = lecturer_id;
END $

-- check_answer (quest_id, answer_id)
CREATE PROCEDURE check_answer(
    IN quest_id INT,
    IN answer_id INT
)BEGIN
    DECLARE is_right_result INT;

    -- Lấy trường is_right cho câu trả lời
    SELECT is_right INTO is_right_result
    FROM quest_options
    WHERE quest_options.quest_id = quest_id AND id = answer_id;

    -- Trả về kết quả is_right
    SELECT is_right_result AS is_right;
END $

-- get_all_quest_n_answers_by_quest_category_id (quest_category_id)
CREATE PROCEDURE get_all_quest_n_answers_by_quest_category_id(
    IN quest_category_id INT
)BEGIN
    SELECT 
        q.id AS quest_id,
        q.content AS quest_content,
        qo.id AS option_id,
        qo.content AS option_content,
        qo.is_right AS is_right
    FROM 
        quests q
    INNER JOIN 
        quest_options qo ON q.id = qo.quest_id
    WHERE 
        q.quest_category_id = quest_category_id
    ORDER BY 
        q.id, qo.id;
END $

-- update_quest_category_name(quest_category_id, new_name)
CREATE PROCEDURE update_quest_category_name(
    IN quest_category_id INT,
    IN new_name NVARCHAR(50)
)BEGIN
    UPDATE quest_categories
    SET name = new_name
    WHERE id = quest_category_id;
END $

-- delete_quest_category(quest_category_id)
CREATE PROCEDURE delete_quest_category(
    IN quest_category_id INT
)BEGIN
    -- Xóa tất cả các lựa chọn trả lời thuộc các câu hỏi trong danh mục
    DELETE FROM quest_options
    WHERE quest_id IN (SELECT id FROM quests WHERE quests.quest_category_id = quest_category_id);

    -- Xóa tất cả các câu hỏi thuộc danh mục
    DELETE FROM quests
    WHERE quests.quest_category_id = quest_category_id;

    -- Xóa danh mục câu hỏi
    DELETE FROM quest_categories
    WHERE id = quest_category_id;
END $

-- update_quest(quest_id, new_quest_content, option1_id, new_option1_content, option2_id, new_option2_content, option3_id, new_option3_content, option4_id, new_option4_content, new_correct_option_id)
CREATE PROCEDURE update_quest(
    IN quest_id INT,
    IN new_quest_content TEXT,
    IN option1_id INT,
    IN new_option1_content TEXT,
    IN option2_id INT,
    IN new_option2_content TEXT,
    IN option3_id INT,
    IN new_option3_content TEXT,
    IN option4_id INT,
    IN new_option4_content TEXT,
    IN new_correct_option_id INT
)BEGIN
    -- Cập nhật nội dung câu hỏi
    UPDATE quests
    SET content = new_quest_content
    WHERE id = quest_id;

    -- Cập nhật nội dung các lựa chọn trả lời
    UPDATE quest_options
    SET content = CASE 
        WHEN id = option1_id THEN new_option1_content
        WHEN id = option2_id THEN new_option2_content
        WHEN id = option3_id THEN new_option3_content
        WHEN id = option4_id THEN new_option4_content
    END,
    is_right = CASE id
        WHEN new_correct_option_id THEN 1
        ELSE 0
    END
    WHERE quest_options.quest_id = quest_id AND id IN (option1_id, option2_id, option3_id, option4_id);
END $

-- delete_quest(quest_id)
CREATE PROCEDURE delete_quest(
    IN quest_id INT
)BEGIN
    -- Xóa tất cả các lựa chọn trả lời thuộc câu hỏi
    DELETE FROM quest_options
    WHERE quest_options.quest_id = quest_id;

    -- Xóa câu hỏi
    DELETE FROM quests
    WHERE id = quest_id;
END $

-- create_exercise(class_id, start_time, end_time, name, descrition) *return exercise_id của exercise vừa tạo ra một giá trị out
CREATE PROCEDURE create_exercise(
    IN class_id INT,
    IN start_time DATETIME,
    IN end_time DATETIME,
    IN name TEXT,
    IN description TEXT
)BEGIN
    INSERT INTO exercises(class_id, start_time, end_time, name, description)
    VALUES (class_id, start_time, end_time, name, description);
    
    SELECT LAST_INSERT_ID() AS exercise_id;
END $

-- update_exercise(exercise_id, start_time, end_time, name, description)
CREATE PROCEDURE update_exercise(
    IN exercise_id INT,
    IN start_time DATETIME,
    IN end_time DATETIME,
    IN name TEXT,
    IN description TEXT
)BEGIN
    UPDATE exercises
    SET
        start_time = IFNULL(start_time, exercises.start_time),
        end_time = IFNULL(end_time, exercises.end_time),
        name = IFNULL(name, exercises.name),
        description = IFNULL(description, exercises.description)
    WHERE id = exercise_id;
END $

-- attach_file_to_exercise(exercise_id, doc_id) //Return của thủ tục trên phục vụ cho thủ tục này
CREATE PROCEDURE attach_file_to_exercise(
    IN exercise_id INT,
    IN doc_id INT
)BEGIN
    INSERT INTO exercise_attach_files(exercise_id, doc_id)
    VALUES (exercise_id, doc_id);
END $

-- reset_exercise_attach_file(exercise_id)
CREATE PROCEDURE reset_exercise_attach_file(
    IN exercise_id INT
)BEGIN
    DELETE FROM exercise_attach_files
    WHERE exercise_attach_files.exercise_id = exercise_id;
END $

-- get_exercise_ids(class_id)
CREATE PROCEDURE get_exercise_ids(
    IN class_id INT
)BEGIN
    SELECT id FROM exercises WHERE exercises.class_id = class_id;
END $

-- get_lecturer_exercise_info(exercise_id)
CREATE PROCEDURE get_lecturer_exercise_info(
    IN exercise_id INT
)BEGIN
    SELECT 
        e.id AS id,
        e.name AS name,
        e.description AS descriptions,
        e.start_time AS start_time,
        e.end_time AS end_time,
        COUNT(se.id) AS submission_count
    FROM exercises e
    LEFT JOIN submitted_exercises se ON e.id = se.exercise_id
    WHERE e.id = exercise_id
    GROUP BY e.id;
END $

-- get_exercise_attach_files(exercise_id)
CREATE PROCEDURE get_exercise_attach_files(
    IN exercise_id INT
)BEGIN
    SELECT 
        doc_id,
        file_name
    FROM exercise_attach_files
    JOIN docs ON exercise_attach_files.doc_id = docs.id
    WHERE exercise_attach_files.exercise_id = exercise_id;
END $

-- delete_exercise(exercise_id)
CREATE PROCEDURE delete_exercise(
    IN exercise_id INT
)BEGIN
    DELETE FROM exercise_attach_files WHERE exercise_attach_files.exercise_id = exercise_id;

    DELETE FROM submitted_exercise_attach_file WHERE submitted_exercises_id IN (
        SELECT id FROM submitted_exercises WHERE submitted_exercises.exercise_id = exercise_id
    );
    DELETE FROM submitted_exercises WHERE submitted_exercises.exercise_id = exercise_id;

    DELETE FROM exercises WHERE id = exercise_id;
END $

-- get_submitted_exercise_files(exercise_id, student_id)
CREATE PROCEDURE get_submitted_exercise_files(
    IN exercise_id INT,
    IN student_id INT
)BEGIN
    SELECT seaf.id, seaf.file_name
    FROM submitted_exercise_attach_file seaf
    INNER JOIN submitted_exercises se ON seaf.submitted_exercises_id = se.id
    WHERE se.exercise_id = exercise_id AND se.student_id = student_id;
END $

-- get_all_submitted_exercise_files(exercise_id)
CREATE PROCEDURE get_all_submitted_exercise_files(
    IN exercise_id INT
)BEGIN
    SELECT seaf.id, seaf.file_name
    FROM submitted_exercise_attach_file seaf
    INNER JOIN submitted_exercises se ON seaf.submitted_exercises_id = se.id
    WHERE se.exercise_id = exercise_id;
END $

-- get_exercise_info_for_student(exercise_id, student_id)
CREATE PROCEDURE get_exercise_info_for_student(
    IN exercise_id INT,
    IN student_id INT
)BEGIN
    DECLARE submission_status VARCHAR(20);

    -- Lấy tình trạng nộp bài của sinh viên cho bài tập
    SELECT 
        CASE 
            WHEN submit_time IS NULL THEN 'unsubmitted'
            WHEN submit_time <= (SELECT end_time FROM exercises WHERE id = exercise_id) THEN 'submitted'
            ELSE 'submitted-late'
        END INTO submission_status
    FROM submitted_exercises
    WHERE submitted_exercises.student_id = student_id AND submitted_exercises.exercise_id = exercise_id;

    -- Lấy thông tin chi tiết của bài tập nếu nó đã bắt đầu
    SELECT 
        e.id AS id,
        e.name AS name,
        e.description AS descriptions,
        e.start_time AS start_time,
        e.end_time AS end_time,
        IFNULL(submission_status, 'unsubmitted') AS submission_status
    FROM exercises e
    WHERE e.id = exercise_id AND e.start_time <= NOW();
END $

CREATE PROCEDURE get_or_create_n_get_submitted_exercise_id(
    IN exercise_id INT,
    IN student_id INT
)BEGIN
    DECLARE submitted_exercise_id INT;

    -- Kiểm tra xem đã tồn tại bài nộp của sinh viên cho bài tập này chưa
    SELECT id INTO submitted_exercise_id
    FROM submitted_exercises
    WHERE submitted_exercises.student_id = student_id AND submitted_exercises.exercise_id = exercise_id;

    -- Nếu chưa tồn tại, tạo mới bài nộp và lấy id
    IF submitted_exercise_id IS NULL THEN
        INSERT INTO submitted_exercises(student_id, exercise_id) VALUES (student_id, exercise_id);
        SET submitted_exercise_id = LAST_INSERT_ID();
    END IF;

    -- Trả về id của bài nộp
    SELECT submitted_exercise_id;
END $

-- attach_file_to_submitted_exercise(submitted_exercises_id, file_name)
CREATE PROCEDURE attach_file_to_submitted_exercise(
    IN submitted_exercises_id INT,
    IN file_name TEXT
)BEGIN
    -- Thêm file đính kèm vào bài tập đã submit
    INSERT INTO submitted_exercise_attach_file(submitted_exercises_id, file_name)
    VALUES (submitted_exercises_id, file_name);

    -- Cập nhật cột submit_time
    UPDATE submitted_exercises
    SET submit_time = CURRENT_TIMESTAMP
    WHERE id = submitted_exercises_id;

    -- Trả về thông tin về file vừa được thêm vào
    SELECT id, file_name
    FROM submitted_exercise_attach_file 
    WHERE id = LAST_INSERT_ID();
END $

-- delete_submitted_exercise_attach_file(submitted_exercise_attach_file_id, student_id, exercise_id)
CREATE PROCEDURE delete_submitted_exercise_attach_file(
    IN submitted_exercise_attach_file_id INT,
    IN student_id INT,
    IN exercise_id INT
)BEGIN
    -- Xóa attach_file từ bài tập
    DELETE FROM submitted_exercise_attach_file 
    WHERE id = submitted_exercise_attach_file_id;
    
    -- Kiểm tra xem submitted_exercise còn attach_file nào không
    IF NOT EXISTS (
        SELECT 1 
        FROM submitted_exercise_attach_file 
        WHERE submitted_exercises_id IN (
            SELECT id 
            FROM submitted_exercises 
            WHERE submitted_exercises.student_id = student_id AND submitted_exercises.exercise_id = exercise_id
        )
    ) THEN
        -- Nếu không còn attach_file nào, xóa submitted_exercise
        DELETE FROM submitted_exercises 
        WHERE submitted_exercises.student_id = student_id AND submitted_exercises.exercise_id = exercise_id;
    END IF;
END $

-- unsubmit_exercise(exercise_id, student_id)
CREATE PROCEDURE unsubmit_exercise(
    IN exercise_id INT,
    IN student_id INT
)BEGIN
    -- Xóa tất cả attach_file của submitted_exercise
    DELETE FROM submitted_exercise_attach_file 
    WHERE submitted_exercises_id IN (
        SELECT id 
        FROM submitted_exercises 
        WHERE student_id = student_id AND exercise_id = exercise_id
    );

    -- Xóa submitted_exercise
    DELETE FROM submitted_exercises 
    WHERE student_id = student_id AND exercise_id = exercise_id;
END $

-- get_students_submission_status(class_id, exercise_id)
CREATE PROCEDURE get_students_submission_status(
    IN class_id INT,
    IN exercise_id INT
)BEGIN
    SELECT
        u.id AS student_id,
        ul.login_id AS login_id,
        u.name AS student_name,
        IF(se.exercise_id IS NOT NULL,
            CASE
                WHEN se.submit_time IS NULL THEN 'unsubmitted'
                WHEN se.submit_time <= e.end_time THEN 'submitted'
                ELSE 'submitted-late'
            END,
            'unsubmitted'
        ) AS submission_status
    FROM users u
    JOIN students s ON u.id = s.id
    JOIN classes_n_students cs ON s.id = cs.student_id
    JOIN classes c ON cs.class_id = c.id
    LEFT JOIN (
        SELECT *
        FROM submitted_exercises
        WHERE exercise_id = exercise_id
    ) se ON cs.student_id = se.student_id
    LEFT JOIN exercises e ON se.exercise_id = e.id
    JOIN (
        SELECT user_id, MIN(id) AS min_id
        FROM user_login_id
        GROUP BY user_id
    ) AS sub_ul ON u.id = sub_ul.user_id
    JOIN user_login_id ul ON sub_ul.user_id = ul.user_id AND sub_ul.min_id = ul.id
    WHERE c.id = class_id
    ORDER BY ul.login_id ASC;
END $

-- get_students_submission_status_with_files(class_id, exercise_id)
CREATE PROCEDURE get_students_submission_status_with_files(
    IN class_id INT,
    IN exercise_id INT
)BEGIN
    SELECT
        u.id AS student_id,
        ul.login_id AS login_id,
        u.name AS student_name,
        IF(se.exercise_id IS NOT NULL,
            CASE
                WHEN MAX(se.submit_time) IS NULL THEN 'unsubmitted'
                WHEN MAX(se.submit_time) <= e.end_time THEN 'submitted'
                ELSE 'submitted-late'
            END,
            'unsubmitted'
        ) AS submission_status,
        GROUP_CONCAT(sef.file_name) AS submitted_files
    FROM users u
    JOIN students s ON u.id = s.id
    JOIN classes_n_students cs ON s.id = cs.student_id
    JOIN classes c ON cs.class_id = c.id
    LEFT JOIN submitted_exercises se ON cs.student_id = se.student_id AND se.exercise_id = exercise_id
    LEFT JOIN exercises e ON se.exercise_id = e.id
    LEFT JOIN submitted_exercise_attach_file sef ON se.id = sef.submitted_exercises_id
    JOIN (
        SELECT user_id, MIN(id) AS min_id
        FROM user_login_id
        GROUP BY user_id
    ) AS sub_ul ON u.id = sub_ul.user_id
    JOIN user_login_id ul ON sub_ul.user_id = ul.user_id AND sub_ul.min_id = ul.id
    WHERE c.id = class_id
    GROUP BY u.id, ul.login_id, u.name, se.exercise_id
    ORDER BY ul.login_id ASC;
END $

-- create_test(class_id, start_time, end_time, name, description, quest_category_id, number_quest_of_tests)
CREATE PROCEDURE create_test(
    in class_id int,
    in start_time datetime,
    in end_time datetime,
    in name text,
    in description text,
    in quest_category_id int,
    in number_quest_of_tests int
)BEGIN
    DECLARE total_quests int;
    DECLARE test_id int;
    DECLARE should_exit BOOLEAN DEFAULT FALSE;

    -- Kiểm tra số lượng câu hỏi trong quest_category
    SELECT COUNT(*) INTO total_quests
    FROM quests
    WHERE quest_category_id = quest_category_id;

    -- Nếu số lượng câu hỏi không đủ
    IF total_quests < number_quest_of_tests THEN
        SIGNAL SQLSTATE '45000'
        SET MESSAGE_TEXT = 'Số lượng câu hỏi không đủ để tạo bài kiểm tra.';
        SET should_exit = TRUE;
    END IF;

    -- Nếu không thoát do điều kiện không đủ câu hỏi
    IF should_exit = FALSE THEN
        -- Tạo bài kiểm tra
        INSERT INTO tests(class_id, start_time, end_time, name, description)
        VALUES(class_id, start_time, end_time, name, description);

        -- Lấy ID của bài kiểm tra vừa được tạo
        SET test_id = LAST_INSERT_ID();

        -- Chọn ngẫu nhiên các câu hỏi từ quest_category và thêm vào test_quests
        INSERT INTO test_quests(test_id, quest_id)
        SELECT test_id, id
        FROM quests
        WHERE quest_category_id = quest_category_id
        ORDER BY RAND()
        LIMIT number_quest_of_tests;
    END IF;
END $

-- get_all_questions_in_test(test_id)
CREATE PROCEDURE get_all_questions_in_test(
    in test_id int
)BEGIN
    -- Truy vấn tất cả câu hỏi và tùy chọn trong bài kiểm tra
    SELECT q.id as question_id, q.content as question_content,
           o.id as option_id, o.content as option_content, o.is_right as is_right_option
    FROM test_quests tq
    JOIN quests q ON tq.quest_id = q.id
    JOIN quest_options o ON q.id = o.quest_id
    WHERE tq.test_id = test_id;
END $

-- submit_test(student_id, test_id) *Return id của submitted_test vừa insert
CREATE PROCEDURE submit_test(
    in student_id int,
    in test_id int,
    out submitted_test_id int
)BEGIN
    -- Thêm bài kiểm tra đã nộp vào bảng submitted_tests
    INSERT INTO submitted_tests(student_id, test_id)
    VALUES(student_id, test_id);

    -- Lấy ID của submitted_test vừa được tạo
    SET submitted_test_id = LAST_INSERT_ID();
END $

-- attach_quest_to_submit_test(submitted_test_id, quest_id, quest_option_id) *Sử dụng giá trị trả về của thủ tục trên làm đầu vào thứ nhất
CREATE PROCEDURE attach_quest_to_submit_test(
    in submitted_test_id int,
    in quest_id int,
    in quest_option_id int
)BEGIN
    -- Thêm câu hỏi đã nộp vào bảng submitted_test_quests
    INSERT INTO submitted_test_quests(submitted_test_id, quest_id, quest_option_id)
    VALUES(submitted_test_id, quest_id, quest_option_id);
END $

-- mark(submitted_test_id) *so sánh câu hỏi đã submit với câu hỏi đã lưu, tính điểm, cập nhật vào trường score của bảng submitted_tests
CREATE PROCEDURE mark(
    in submitted_test_id int
)BEGIN
    DECLARE total_score DECIMAL(4, 2) DEFAULT 0.0;
    DECLARE total_questions INT;

    -- Lấy tổng số câu hỏi của bài kiểm tra
    SELECT COUNT(*) INTO total_questions
    FROM test_quests
    WHERE test_id = (
        SELECT test_id
        FROM submitted_tests
        WHERE id = submitted_test_id
    );

    -- Tính điểm
    SELECT SUM(is_right) INTO total_score
    FROM (
        SELECT t.quest_option_id, qo.is_right
        FROM submitted_test_quests t
        INNER JOIN quest_options qo ON t.quest_option_id = qo.id
        WHERE t.submitted_test_id = submitted_test_id
    ) AS subquery;

    -- Tính điểm trung bình
    IF total_questions > 0 THEN
        SET total_score = (total_score / total_questions) * 10;
    END IF;

    -- Cập nhật điểm vào bảng submitted_tests
    UPDATE submitted_tests
    SET score = total_score
    WHERE id = submitted_test_id;
END $

DELIMITER ;