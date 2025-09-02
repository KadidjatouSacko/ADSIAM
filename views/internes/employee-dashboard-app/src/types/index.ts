export interface Employee {
    id: string;
    name: string;
    role: string;
    status: 'active' | 'inactive' | 'on-leave';
    email: string;
    phone: string;
}

export interface Task {
    id: string;
    title: string;
    description: string;
    assignedTo: string; // Employee ID
    dueDate: Date;
    status: 'pending' | 'in-progress' | 'completed';
}

export interface Student {
    id: string;
    name: string;
    email: string;
    enrolledCourses: string[]; // Array of course IDs
}

export interface Evaluation {
    id: string;
    employeeId: string; // Employee ID
    taskId: string; // Task ID
    score: number;
    feedback: string;
    date: Date;
}