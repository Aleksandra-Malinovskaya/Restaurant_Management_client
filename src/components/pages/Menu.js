import React from "react";
import Navbar from "../Layout/Navbar";

const Menu = () => {
  return (
    <div className="min-vh-100 bg-light">
      <Navbar />
      <div className="container-fluid py-4">
        <div className="row">
          <div className="col-12">
            <div className="card">
              <div className="card-header bg-primary text-white">
                <h4 className="mb-0">
                  <i className="bi bi-card-checklist me-2"></i>
                  Меню ресторана
                </h4>
              </div>
              <div className="card-body">
                <p>Страница меню в разработке...</p>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default Menu;
