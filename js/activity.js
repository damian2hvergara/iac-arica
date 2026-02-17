/* ========================================
   activity.js - Notificaciones en Tiempo Real
   Import American Cars
   ======================================== */

class ActivitySystem {
    constructor() {
        this.subscription = null;
        this.notificationQueue = [];
        this.isShowing = false;
        this.simulatedActivities = [];
        this.currentIndex = 0;
    }

    /**
     * Inicializar sistema
     */
    async init() {
        // Crear elemento de notificación si no existe
        this.createNotificationElement();

        // Cargar actividad reciente para simular
        await this.loadRecentActivity();

        // Intentar suscribirse a tiempo real
        this.subscribeToRealtime();

        // Iniciar simulación de actividad
        if (APP_CONFIG.notifications.enabled) {
            this.startSimulation();
        }
    }

    /**
     * Crear elemento de notificación
     */
    createNotificationElement() {
        if (document.getElementById('activityNotification')) return;

        const html = `
            <div class="notification-toast" id="activityNotification">
                <img src="" alt="" class="notification-avatar" id="notificationAvatar">
                <div class="notification-content">
                    <strong id="notificationTitle"></strong>
                    <span id="notificationMeta"></span>
                </div>
                <button class="notification-close" onclick="activitySystem.hide()">
                    <i class="fas fa-times"></i>
                </button>
            </div>
        `;

        document.body.insertAdjacentHTML('beforeend', html);
    }

    /**
     * Cargar actividad reciente
     */
    async loadRecentActivity() {
        try {
            const activities = await vehicleAPI.getRecentActivity(10);
            
            if (activities.length > 0) {
                this.simulatedActivities = activities;
            } else {
                // Usar actividades de ejemplo
                this.simulatedActivities = this.getDefaultActivities();
            }
        } catch (error) {
            console.error('Error loading activity:', error);
            this.simulatedActivities = this.getDefaultActivities();
        }
    }

    /**
     * Actividades de ejemplo
     */
    getDefaultActivities() {
        return [
            {
                action_type: 'reservation',
                user_name: 'Rodrigo M.',
                user_avatar: 'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=100',
                vehicle_name: 'RAM 1500 Limited',
                city: 'Santiago',
                created_at: new Date(Date.now() - 2 * 60 * 60 * 1000).toISOString()
            },
            {
                action_type: 'inquiry',
                user_name: 'Carolina P.',
                user_avatar: 'https://images.unsplash.com/photo-1438761681033-6461ffad8d80?w=100',
                vehicle_name: 'Ford Mustang GT',
                city: 'Viña del Mar',
                created_at: new Date(Date.now() - 30 * 60 * 1000).toISOString()
            },
            {
                action_type: 'delivery',
                user_name: 'Felipe C.',
                user_avatar: 'https://images.unsplash.com/photo-1472099645785-5658abf4ff4e?w=100',
                vehicle_name: 'Ford F-150 Platinum',
                city: 'Temuco',
                created_at: new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString()
            },
            {
                action_type: 'reservation',
                user_name: 'Andrea L.',
                user_avatar: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?w=100',
                vehicle_name: 'Chevrolet Camaro 2SS',
                city: 'Concepción',
                created_at: new Date(Date.now() - 4 * 60 * 60 * 1000).toISOString()
            },
            {
                action_type: 'inquiry',
                user_name: 'Marcelo R.',
                user_avatar: 'https://images.unsplash.com/photo-1500648767791-00dcc994a43e?w=100',
                vehicle_name: 'Chevrolet Tahoe',
                city: 'Antofagasta',
                created_at: new Date(Date.now() - 45 * 60 * 1000).toISOString()
            }
        ];
    }

    /**
     * Suscribirse a cambios en tiempo real
     */
    subscribeToRealtime() {
        try {
            this.subscription = vehicleAPI.subscribeToActivity((newActivity) => {
                this.handleNewActivity(newActivity);
            });
        } catch (error) {
            console.error('Error subscribing to realtime:', error);
        }
    }

    /**
     * Manejar nueva actividad
     */
    handleNewActivity(activity) {
        // Agregar a la cola
        this.notificationQueue.push(activity);

        // Mostrar si no hay otra mostrándose
        if (!this.isShowing) {
            this.showNext();
        }
    }

    /**
     * Iniciar simulación de actividad
     */
    startSimulation() {
        const config = APP_CONFIG.notifications;

        // Primera notificación después del delay inicial
        setTimeout(() => {
            this.showSimulatedActivity();
        }, config.initialDelay);

        // Notificaciones periódicas
        setInterval(() => {
            this.showSimulatedActivity();
        }, config.interval);
    }

    /**
     * Mostrar actividad simulada
     */
    showSimulatedActivity() {
        if (this.simulatedActivities.length === 0) return;

        const activity = this.simulatedActivities[this.currentIndex];
        this.show(activity);

        // Avanzar al siguiente
        this.currentIndex = (this.currentIndex + 1) % this.simulatedActivities.length;
    }

    /**
     * Mostrar notificación
     */
    show(activity) {
        if (!activity) return;

        const notification = document.getElementById('activityNotification');
        const avatarEl = document.getElementById('notificationAvatar');
        const titleEl = document.getElementById('notificationTitle');
        const metaEl = document.getElementById('notificationMeta');

        if (!notification || !avatarEl || !titleEl || !metaEl) return;

        // Configurar contenido
        const actionConfig = APP_CONFIG.notifications.actions[activity.action_type] || {
            verb: 'interactuó con',
            icon: 'fas fa-bell'
        };

        avatarEl.src = activity.user_avatar || 'https://via.placeholder.com/36';
        avatarEl.alt = activity.user_name || 'Usuario';
        
        titleEl.textContent = `${activity.user_name || 'Alguien'} ${actionConfig.verb} ${activity.vehicle_name || 'un vehículo'}`;
        metaEl.textContent = `${APP_CONFIG.format.timeAgo(activity.created_at)} · ${activity.city || 'Chile'}`;

        // Mostrar con animación
        notification.classList.add('show');
        this.isShowing = true;

        // Ocultar después del tiempo configurado
        setTimeout(() => {
            this.hide();
        }, APP_CONFIG.notifications.displayDuration);
    }

    /**
     * Ocultar notificación
     */
    hide() {
        const notification = document.getElementById('activityNotification');
        if (notification) {
            notification.classList.remove('show');
        }
        this.isShowing = false;

        // Mostrar siguiente en cola si existe
        if (this.notificationQueue.length > 0) {
            setTimeout(() => {
                const next = this.notificationQueue.shift();
                this.show(next);
            }, 500);
        }
    }

    /**
     * Registrar actividad del usuario actual
     */
    async logUserActivity(type, vehicleData = {}) {
        // Nombres de ejemplo para simular (en producción esto vendría del usuario)
        const cities = ['Santiago', 'Viña del Mar', 'Concepción', 'Temuco', 'Antofagasta', 'La Serena', 'Valparaíso'];
        const randomCity = cities[Math.floor(Math.random() * cities.length)];

        await vehicleAPI.logActivity(type, {
            vehicleId: vehicleData.id,
            vehicleName: vehicleData.name,
            city: randomCity
        });
    }

    /**
     * Destruir sistema
     */
    destroy() {
        if (this.subscription) {
            vehicleAPI.unsubscribeFromActivity();
            this.subscription = null;
        }
    }
}

// Crear instancia global
const activitySystem = new ActivitySystem();
window.activitySystem = activitySystem;

/* ========================================
   FIN DE ACTIVITY.JS
   ======================================== */
