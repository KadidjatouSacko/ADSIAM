import { Router } from 'express';
import DashboardController from '../controllers/dashboardController';

const router = Router();
const dashboardController = new DashboardController();

// Route to get dashboard data
router.get('/dashboard', dashboardController.getDashboardData);

// Route to manage students
router.post('/students', dashboardController.manageStudents);

// Route to handle evaluations
router.post('/evaluations', dashboardController.handleEvaluations);

// Route to fetch assigned tasks
router.get('/tasks', dashboardController.getAssignedTasks);

export default router;