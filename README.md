# DocVault - Premium Document Manager

DocVault is a full-stack Node.js web application designed to be a stylish, premium archive for files and URLs. It features a Neo-Brutalist "Pixelate" Light Theme, mobile-responsive grids, custom ripple effects, and a secure admin portal to manage documents.

## Features

- **Pixel-Premium Light Theme**: Custom CSS with 'Space Grotesk' and 'VT323' Google Fonts, featuring dot-matrix backgrounds and heavy-set box shadows.
- **Unified Admin Dashboard**: A sleek, two-option admin dashboard where you can provide strings, files, or URLs. File sizes are instantly parsed and presented to you upon selection.
- **RESTful API**: Clean backend built on Express.js utilizing `multer` for solid drag-and-drop file stream handling and Mongoose for MongoDB.
- **Security built-in**: Features cookie-based JWT sessions. Login requires only a secure password.

## Prerequisites

- **Node.js** (v14+ recommended)
- **MongoDB** (You need a valid connection string to a MongoDB cluster).

## Installation

1. Open your terminal and clone/navigate to the project directory.
2. Install the necessary dependencies via NPM:
   ```bash
   npm install
   ```

## Configuration

In the root directory, there is a `.env` file containing configuration variables:
```env
PORT=enter port 
MONGO_URI=mongodb+srv://<database name>:<db pass>.fqgybr7.mongodb.net/mydocweb
JWT_SECRET= JWT 
```

## Running the Application

To run the application in a development environment with auto-reloading:
```bash
npm run dev
```

To run the application in production:
```bash
npm start
```

Once running, you can view the application in your browser at `http://localhost:port`.

## Admin Usage

- Navigate to `http://localhost:port/login` or click "Admin Access" in the top right.
- You do not need a username. Enter the default system password:
  **Password**: `1234`
  *(Note: This password is auto-injected on the initial server start if the server detects the database is empty).*
- Once inside, you can Drag & Drop files or type out URLs into the 'Smart Upload' Unified panel.
- Change your password anytime in the "Security" section.

---
**Made By Jit Singha Mahapatra**