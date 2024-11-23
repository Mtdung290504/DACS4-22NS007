create database if not exists db_dacs4 character set utf8 collate utf8_general_ci;
use db_dacs4;

-- Bảng chứa thông tin người dùng.
create table if not exists users (
	id int primary key auto_increment,
    is_lecturer tinyint default null,
    name nvarchar(50) not null,
    phone_number varchar(12) unique default null,
    email varchar(100) unique default null,
    password varchar(100)
);

-- Bảng chứa thông tin tài khoản login của người dùng (cho phép login bằng số điện thoại, email, mã sv).
create table if not exists user_login_id (
	id int primary key auto_increment,
	user_id int not null,
    login_id nvarchar(100) not null unique,
    foreign key (user_id) references users(id) -- on delete cascade -- *Chưa cần sử dụng đến
);

-- Bảng chứa id của các user có role là lecturer (is_lecturer = 1).
create table if not exists lecturers (
	id int not null,
    foreign key (id) references users(id) -- on delete cascade -- *Chưa cần sử dụng đến
);

-- Bảng chứa id của các user có role là student (is_lecturer = 0).
create table if not exists students (
	id int not null,
    foreign key (id) references users(id) -- on delete cascade -- *Chưa cần sử dụng đến
);

-- Bảng chứa thông tin chung của lớp học.
create table if not exists classes (
    id int primary key auto_increment,
    name nvarchar(50) not null,
    lecturer_id int not null,
    invite_code_students varchar(36) unique not null, -- Mã mời học viên
    is_open_students tinyint(1) default 1, -- Trạng thái mở/đóng của mã mời học viên
    foreign key (lecturer_id) references lecturers(id) -- on delete cascade -- *Chưa cần sử dụng đến
);

-- Bảng chứa thông tin về cộng tác viên của lớp học.
create table if not exists class_collaborators (
    id int primary key auto_increment,
    class_id int not null,
    lecturer_id int not null,
    foreign key (class_id) references classes(id) on delete cascade,
    foreign key (lecturer_id) references lecturers(id) -- on delete cascade -- *Chưa cần sử dụng đến
);

-- Bảng thể hiện mối quan hệ n - n giữa class với student.
create table if not exists classes_n_students (
	class_id int not null,
	student_id int not null,
    foreign key (class_id) references classes(id) on delete cascade,
    foreign key (student_id) references students(id) on delete cascade
);

-- Bảng chứa thông tin về danh mục tài liệu.
create table if not exists doc_categories (
	id int primary key auto_increment,
	name nvarchar(50) not null,
    lecturer_id int not null,
    foreign key (lecturer_id) references lecturers(id) -- on delete cascade -- *Chưa cần sử dụng đến
);

-- Bảng chứa thông tin về tài liệu.
create table if not exists docs (
	id int primary key auto_increment,
	file_name text not null,
    doc_category_id int not null,
    foreign key (doc_category_id) references doc_categories(id) on delete cascade
);

-- Bảng chứa thông tin về các tài liệu được đính kèm vào class (Cũng thể hiện mối quan hệ n - n giữa chúng).
create table if not exists class_attach_files (
	class_id int not null,
    doc_id int not null,
    foreign key (class_id) references classes(id) on delete cascade,
    foreign key (doc_id) references docs(id) on delete cascade
);

-- Bảng chứa thông tin về các phòng học trực tuyến
create table if not exists meetings (
    id int primary key auto_increment,
    class_id int not null,
    start_time datetime not null,
    end_time datetime not null,
    name nvarchar(100) not null,
    description text,
    meeting_code varchar(36) unique not null,
    foreign key (class_id) references classes(id) on delete cascade
);

-- Bảng chứa thông tin về bài tập.
create table if not exists exercises (
	id int primary key auto_increment,
    class_id int not null,
    start_time datetime not null,
    end_time datetime not null,
    name text not null,
    description text,
    foreign key (class_id) references classes(id) on delete cascade
);

-- Bảng chứa thông tin về các file đính kèm trong bài tập.
create table if not exists exercise_attach_files (
	exercise_id int not null,
    doc_id int not null,
    foreign key (exercise_id) references exercises(id) on delete cascade,
    foreign key (doc_id) references docs(id) on delete cascade
);

-- Bảng chứa thông tin về các bài tập đã nộp.
create table if not exists submitted_exercises (
	id int primary key auto_increment,
	student_id int not null,
    exercise_id int not null,
    submit_time timestamp default current_timestamp,
    foreign key (student_id) references classes_n_students(student_id) on delete cascade,
    foreign key (exercise_id) references exercises(id) on delete cascade
);

-- Bảng chứa thông tin về các file được người nộp đính kèm trong bài tập nộp lên.
create table if not exists submitted_exercise_attach_file (
    id int primary key auto_increment,
	submitted_exercises_id int not null,
    file_name text,
    foreign key (submitted_exercises_id) references submitted_exercises(id) on delete cascade
);