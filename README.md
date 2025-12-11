# SynapStore

![License](https://img.shields.io/badge/license-MIT-blue.svg)
![TypeScript](https://img.shields.io/badge/TypeScript-5.0-blue)
![React](https://img.shields.io/badge/React-18.0-blue)
![Node.js](https://img.shields.io/badge/Node.js-18%2B-green)

**SynapStore** is a robust, enterprise-grade platform designed to streamline the complex interactions between Store Owners and Suppliers. It facilitates seamless inventory management, supplier discovery, and operational workflows through a secure, high-performance web interface.

Built with modern web technologies, SynapStore prioritizes performance, security, and a premium user experience.

---

## Key Features

- **Role-Based Access Control (RBAC)**: secure environments for **Super Admins**, **Store Owners**, and **Suppliers** with distinctive permissions and dashboards.
- **Advanced Authentication**:
  - Secure Email/Password login with Bcrypt encryption.
  - OTP-based Email Verification.
  - Google OAuth integration.
- **Supplier Network**:
  - Global Supplier Discovery system.
  - Connection request auditing and management (Accept/Reject flows).
- **Inventory Management**:
  - Efficient product tracking and management.
  - Bulk inventory uploads supported by background processing.
- **Real-Time Notifications**:
  - In-app notification system for critical updates.
  - Email notifications for offline engagement.
- **Analytics & Reporting**:
  - comprehensive admin dashboard for system-wide metrics.
  - Store-specific status and performance overview.

---

##  Tech Stack

### Client (`/client`)
- **Framework**: React 18 with Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Framer Motion (Animations)
- **State Management**: Recoil
- **UI Components**: Radix UI primitives, React Icons, Lucide React
- **Routing**: React Router DOM (v7)

### Backend (`/backend`)
- **Runtime**: Node.js
- **Framework**: Express.js
- **Language**: TypeScript
- **Database**: PostgreSQL
- **ORM**: Prisma (with adapter-pg)
- **Queue System**: BullMQ with Redis
- **Validation**: Zod
- **Security**: Helmet, CORS, Bcrypt, JWT
- **Email**: Nodemailer

---

##  Getting Started

### Prerequisites
Ensure you have the following installed on your local machine:
- [Node.js](https://nodejs.org/) (v18 or higher)
- [npm](https://www.npmjs.com/) or [yarn](https://yarnpkg.com/)
- [PostgreSQL](https://www.postgresql.org/)
- [Redis](https://redis.io/) (for background jobs)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/sreecharan-desu/SynapStore.git
   cd SynapStore
   ```

2. **Setup Backend**
   ```bash
   cd backend
   npm install
   ```

3. **Setup Client**
   ```bash
   cd ../client
   npm install
   ```

---

##  Configuration

### Environment Variables

Both the Client and Backend require environment variables to function correctly. We have provided example files for your convenience.

1. **Backend**:
   - Copy `.env.example` to `.env` in the `backend/` directory.
   - Fill in your PostgreSQL connection string, Redis details, SMTP credentials, and JWT secrets.

2. **Client**:
   - Copy `.env.example` to `.env` in the `client/` directory.
   - Update `VITE_API_URL` if your backend is running on a port other than `3000`.

---

## 🏃‍♂️ Running the Application

### Development Mode

1. **Start the Backend Server**
   ```bash
   cd backend
   # Starts the API server and the Worker process
   npm run dev
   ```
   The backend will start at `http://localhost:3000`.

2. **Start the Client Development Server**
   ```bash
   cd client
   npm run dev
   ```
   The client will be available at `http://localhost:5173`.

### Production Build

1. **Build Backend**
   ```bash
   cd backend
   npm run build
   npm start
   ```

2. **Build Client**
   ```bash
   cd client
   npm run build
   npm run preview
   ```

---

## Project Structure

```bash
SynapStore/
├── backend/                # Node.js API Server
│   ├── lib/                # Shared libraries (Auth, Crypto, Mailer)
│   ├── middleware/         # Express middlewares
│   ├── prisma/             # Database schema & migrations
│   ├── routes/             # API Route definitions
│   └── worker/             # Background job processors
├── client/                 # React Frontend
│   ├── src/
│   │   ├── components/     # Reusable UI components
│   │   ├── hooks/          # Custom React hooks
│   │   ├── pages/          # Application pages
│   │   └── state/          # Global state (Recoil)
└── README.md
```

---

## Contributing

Contributions are welcome! Please follow these steps:
1. Fork the project.
2. Create your feature branch (`git checkout -b feature/AmazingFeature`).
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`).
4. Push to the branch (`git push origin feature/AmazingFeature`).
5. Open a Pull Request.

---

##  License

This project is licensed under the MIT License - see the LICENSE file for details.
