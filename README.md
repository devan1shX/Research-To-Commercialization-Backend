# Research to Commercialization (R2C.ai) - Backend

![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)
![Node.js](https://img.shields.io/badge/Node.js-339933?style=for-the-badge&logo=nodedotjs&logoColor=white)
![Express.js](https://img.shields.io/badge/Express.js-000000?style=for-the-badge&logo=express&logoColor=white)
![MongoDB](https://img.shields.io/badge/MongoDB-47A248?style=for-the-badge&logo=mongodb&logoColor=white)
![Firebase](https://img.shields.io/badge/Firebase-FFCA28?style=for-the-badge&logo=firebase&logoColor=black)

The official backend server for the R2C.ai platform. This server handles user authentication, data storage, document processing, and provides a RESTful API for the frontend client.

---

## 🚀 Features

* **RESTful API:** A well-structured API for managing users, studies, and chat interactions.
* **Firebase Authentication:** Secure user management and token verification using Firebase Admin SDK.
* **MongoDB Integration:** Uses Mongoose for elegant data modeling and interaction with a MongoDB database.
* **Document Processing:** Manages PDF uploads and spawns a Python script for AI-based analysis and text processing.
* **Secure & Scalable:** Built with security best practices, including middleware for authentication and robust error handling.

---

## 🛠️ Tech Stack

* **[Node.js](https://nodejs.org/):** JavaScript runtime environment.
* **[Express.js](https://expressjs.com/):** Web application framework for Node.js.
* **[MongoDB](https://www.mongodb.com/):** NoSQL database for storing study and user data.
* **[Mongoose](https://mongoosejs.com/):** Object Data Modeling (ODM) library for MongoDB.
* **[Firebase Admin SDK](https://firebase.google.com/docs/admin/setup):** For backend authentication and user management.
* **[Multer](https://github.com/expressjs/multer):** Middleware for handling `multipart/form-data`, used for file uploads.

---

## 🏁 Getting Started

Follow these instructions to set up and run the backend server locally.

### **Prerequisites**

* [Node.js](https://nodejs.org/) and [npm](https://www.npmjs.com/) installed.
* Access to a [MongoDB](https://www.mongodb.com/) database instance.
* A Firebase project with the Admin SDK enabled.

### **Installation & Setup**

1.  **Clone the repository:**
    ```sh
    git clone [https://github.com/devan1shX/Research-To-Commercialization-Backend.git](https://github.com/devan1shX/Research-To-Commercialization-Backend.git)
    ```
2.  **Navigate to the project directory:**
    ```sh
    cd Research-To-Commercialization-Backend
    ```
3.  **Install NPM packages:**
    ```sh
    npm install
    ```
4.  **Set up Firebase:**
    * Download your `serviceAccountKey.json` file from your Firebase project settings.
    * Place the file in the root directory of the backend project.

5.  **Configure Environment Variables:**
    * The database connection string is likely managed in `config/db.js`. For a professional setup, it's recommended to use a `.env` file to store sensitive information like your MongoDB URI.

### **Running the Server**

To start the server with automatic reloading on file changes, use nodemon:

```sh
nodemon server.js
