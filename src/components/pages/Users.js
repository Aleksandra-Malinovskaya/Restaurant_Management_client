import React from "react";
import Navbar from "../Layout/Navbar";

const Users = () => {
  return (
    <div className="min-vh-100 bg-light">
      <Navbar />
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-danger text-white">
                <h4 className="mb-0">
                  <i className="bi bi-people me-2"></i>
                  Управление пользователями
                </h4>
              </div>
              <div className="card-body">
                <p>Страница пользователей в разработке...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Users;
