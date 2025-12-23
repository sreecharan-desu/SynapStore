from typing import Annotated, TypedDict, Literal, Optional, Dict, List
import os
from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException, Request
from pydantic import BaseModel
from contextlib import asynccontextmanager
import openai
from logging_setup import setup_app_logger
from fastapi.responses import FileResponse
from pathlib import Path

from langgraph.graph import StateGraph, START
from langgraph.graph.message import add_messages
from langchain_openai import ChatOpenAI
from langgraph.checkpoint.postgres.aio import AsyncPostgresSaver
from langgraph.prebuilt import ToolNode, tools_condition, InjectedState
from langchain_core.tools import tool

from typing import Dict, Optional, List
from fastapi import UploadFile, File, Query, BackgroundTasks
from fastapi.responses import FileResponse
from sqlalchemy import (
    create_engine, Column, String, Integer, DateTime, Boolean, ForeignKey, JSON, DECIMAL, and_
)
from sqlalchemy.orm import declarative_base, sessionmaker, Session
from sqlalchemy.sql import func
from datetime import datetime, timedelta
from sqlalchemy import DateTime
import pandas as pd
import uuid

from cryptography.hazmat.primitives.ciphers.aead import AESGCM
import base64, os, hashlib
import json

from threading import Thread
from email_client import (
    send_storeowner_dispatch_email,
    send_supplier_failure_email,
)

from auth_middleware import jwt_auth_middleware

from prophet import Prophet
import requests

from statistics import mean

import re

load_dotenv(override=True)

logger = setup_app_logger("app")

DB_URI = os.getenv("DATABASE_URL")
BASE_URL = os.getenv("BASE_URL")
API_KEY = os.getenv("API_KEY")
MODEL_NAME = os.getenv("MODEL_NAME")
SECRET_KEY = base64.b64decode(os.getenv("CRYPTO_KEY"))

BASE_DIR = Path(__file__).resolve().parent
SUPPLIER_TEMPLATE_PATH = BASE_DIR / "templates" / "supplier_upload_template.xlsx"

UPLOAD_STORE = Path("/tmp/zenith_uploads")
UPLOAD_STORE.mkdir(parents=True, exist_ok=True)

if not all ([DB_URI, BASE_URL, API_KEY, MODEL_NAME]):
    raise ValueError("One or more required environment variables are missing.")


engine = create_engine(DB_URI, pool_pre_ping=True)
SessionLocal = sessionmaker(bind=engine, autocommit=False, autoflush=False)

Base = declarative_base()


class User(Base):
    __tablename__ = "User"
    id = Column(String, primary_key=True)
    email = Column(String, nullable=False)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime, server_default=func.now())
    globalRole = Column(String, nullable=False)


class Store(Base):
    __tablename__ = "Store"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    slug = Column(String, unique=True, index=True)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime, server_default=func.now())

class Supplier(Base):
    __tablename__ = "Supplier"
    id = Column(String, primary_key=True)
    name = Column(String, nullable=False)
    phone = Column(String, nullable=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=True)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime, server_default=func.now())


class Medicine(Base):
    __tablename__ = "Medicine"
    id = Column(String, primary_key=True)
    ndc = Column(String, nullable=True, index=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False, index=True)
    sku = Column(String, nullable=True, index=True)
    brandName = Column(String, nullable=False)
    genericName = Column(String, nullable=True)
    dosageForm = Column(String, nullable=True)
    strength = Column(String, nullable=True)
    uom = Column(String, nullable=True)
    category = Column(String, nullable=True)
    isActive = Column(Boolean, default=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(),
                       onupdate=func.now(), nullable=False)


class InventoryBatch(Base):
    __tablename__ = "InventoryBatch"
    id = Column(String, primary_key=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False, index=True)
    medicineId = Column(String, ForeignKey("Medicine.id"), nullable=False, index=True)
    batchNumber = Column(String, nullable=True, index=True)
    qtyReceived = Column(Integer, default=0)
    qtyAvailable = Column(Integer, default=0)
    qtyReserved = Column(Integer, default=0)
    expiryDate = Column(DateTime, nullable=True, index=True)
    purchasePrice = Column(DECIMAL(12, 2), nullable=True)
    mrp = Column(DECIMAL(12, 2), nullable=True)
    receivedAt = Column(DateTime, nullable=True)
    location = Column(String, nullable=True)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)
    updatedAt = Column(DateTime, server_default=func.now(), onupdate=func.now(), nullable=False)


class StockMovement(Base):
    __tablename__ = "StockMovement"
    id = Column(String, primary_key=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False, index=True)
    inventoryId = Column(String, ForeignKey("InventoryBatch.id"), nullable=False)
    medicineId = Column(String, ForeignKey("Medicine.id"), nullable=False, index=True)
    delta = Column(Integer, nullable=False)
    reason = Column(String, nullable=False)
    note = Column(String, nullable=True)
    createdAt = Column(DateTime, server_default=func.now())


class Upload(Base):
    __tablename__ = "Upload"

    id = Column(String, primary_key=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    filename = Column(String, nullable=True)
    status = Column(String, nullable=False, server_default="PENDING")
    metadata_json = Column("metadata", JSON, nullable=True)

    createdAt = Column(
        DateTime,
        nullable=False,
        server_default=func.now()
    )
    
    updatedAt = Column(
        DateTime,
        nullable=False,
        server_default=func.now(),
        onupdate=func.now()
    )


class UserStoreRole(Base):
    __tablename__ = "UserStoreRole"

    id = Column(String, primary_key=True)
    userId = Column(String, ForeignKey("User.id"), nullable=False)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    role = Column(String) 


class ActivityLog(Base):
    __tablename__ = "ActivityLog"

    id = Column(String, primary_key=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    action = Column(String, nullable=False)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)


class AuditLog(Base):
    __tablename__ = "AuditLog"

    id = Column(String, primary_key=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    resource = Column(String, nullable=False)
    action = Column(String, nullable=False)
    createdAt = Column(DateTime, server_default=func.now(), nullable=False)

class Sale(Base):
    __tablename__ = "Sale"
    id = Column(String, primary_key=True)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    totalValue = Column(DECIMAL(12, 2))
    paymentStatus = Column(String, default="PENDING")
    createdAt = Column(DateTime, server_default=func.now())

class SaleItem(Base):
    __tablename__ = "SaleItem"
    id = Column(String, primary_key=True)
    saleId = Column(String, ForeignKey("Sale.id"), nullable=False)
    medicineId = Column(String, ForeignKey("Medicine.id"), nullable=False)
    qty = Column(Integer)
    lineTotal = Column(DECIMAL(12, 2))

class SupplierRequest(Base):
    __tablename__ = "SupplierRequest"
    id = Column(String, primary_key=True)
    supplierId = Column(String, ForeignKey("Supplier.id"), nullable=False)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    message = Column(String, nullable=True)
    status = Column(String, default="PENDING") # PENDING, ACCEPTED, REJECTED
    createdAt = Column(DateTime, server_default=func.now())

class SupplierStore(Base):
    __tablename__ = "SupplierStore"
    id = Column(String, primary_key=True)
    supplierId = Column(String, ForeignKey("Supplier.id"), nullable=False)
    storeId = Column(String, ForeignKey("Store.id"), nullable=False)
    createdAt = Column(DateTime, server_default=func.now())


class State(TypedDict):
    messages: Annotated[list, add_messages]
    role: Literal["STORE_OWNER", "SUPPLIER", "SUPERADMIN"]
    user_id: str
    store_id: str | None
    supplier_id: str | None
    user_email: str


class ChatRequest(BaseModel):
    message: str
    thread_id: str | None = None


class ChatResponse(BaseModel):
    reply_markdown: str


class PriceSurgeRisk(BaseModel):
    risk_level: str
    expected_increase_pct: float
    recommendation: str
    baseline_price: float
    recent_price: float

class ForecastRequest(BaseModel):
    store_id: str
    medicine_id: str
    horizon_days: List[int] = [7, 15, 30]


class ForecastResponse(BaseModel):
    medicine_name: str
    current_stock: int

    demand_forecast: Dict[str, int]
    reorder_quantity: Dict[str, int]
    reorder_now: bool

    expiry_risk: Dict[str, int]
    estimated_waste_units: int

    plot_data: Dict

    price_surge_risk: Optional[PriceSurgeRisk] = None
    price_plot_data: Optional[Dict] = None

    

EMAIL_BASE_URL = os.getenv("EMAIL_BASE_URL")
APP_LOGO_URL = "https://res.cloudinary.com/dzunpdnje/image/upload/v1765706720/SynapStore_Logo_g2tlah.png"

@tool
def send_email(
    subject: str,
    title: str,
    message: str,
    email: str,
    footer_note: str = "This is an automated message from SynapStore.",
) -> dict:
    """
    Sends a well-formatted HTML email. 
    
    If the user asks to email themselves (e.g., "send me a copy"), 
    
    Use this tool whenever the user asks to:
    - send an email
    - notify someone or themselves
    - share a report via email
    - confirm an action by email
    """

  
    html_body = f"""
    <html>
      <body style="font-family:Arial,Helvetica,sans-serif;background:#f6f7f9;padding:20px;">
        <div style="
            max-width:600px;
            margin:auto;
            background:#ffffff;
            padding:24px;
            border-radius:8px;
            border:1px solid #e0e0e0;
        ">

          <div style="text-align:center;margin-bottom:20px;">
            <img src="{APP_LOGO_URL}" alt="SynapStore"
                 style="max-width:140px;height:auto;" />
          </div>

          <h2 style="color:#1fa463;margin-top:0;text-align:center;">
            {title}
          </h2>

          <p style="font-size:15px;color:#333;line-height:1.6;">
            {message}
          </p>

          <hr style="margin:24px 0;border:none;border-top:1px solid #eee;">

          <p style="font-size:13px;color:#666;">
            {footer_note or "This is an automated message from SynapStore."}
          </p>

          <p style="font-size:12px;color:#999;text-align:center;margin-top:20px;">
            © SynapStore — Intelligent Pharmacy Management
          </p>

        </div>
      </body>
    </html>
    """

    payload = {
        "email": email.strip(),
        "subject": subject,
        "html": html_body
    }

    url = f"{EMAIL_BASE_URL}/api/v1/email/send"

    try:
        print(f"DEBUG: Sending email to {url} with payload keys: {list(payload.keys())}")
        
        resp = requests.post(url, json=payload, timeout=10)

        print(f"DEBUG: Server Response Code: {resp.status_code}")
        print(f"DEBUG: Server Response Body: {resp.text}")

        if resp.status_code >= 400:
            # Added print to see the actual error from the API
            print(f"DEBUG: Email API Error {resp.status_code}: {resp.text}")
            
            return {
                "status": "failed",
                "status_code": resp.status_code,
                "error": resp.text, 
            }

        return {
            "status": "sent",
            "response": resp.json(),
        }
    except Exception as e:
        return {"status": "failed", "error": str(e)}


# STORE OWNER TOOLS
@tool
def store_inventory_summary(store_id: str) -> dict:
    """
    Returns a high-level inventory snapshot for a single store.

    Use this when the user wants:
    - Overall inventory health
    - Total medicines count
    - Total available units
    - A quick operational summary

    The response is suitable for dashboards and executive summaries.
    """

    session = SessionLocal()
    try:
        total_medicines = (
            session.query(Medicine)
            .filter(Medicine.storeId == store_id)
            .count()
        )

        total_units = (
            session.query(func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0))
            .filter(InventoryBatch.storeId == store_id)
            .scalar()
        )

        return {
            "total_medicines": total_medicines,
            "total_units_available": int(total_units),
        }
    finally:
        session.close()


@tool
def store_list_medicines(store_id: str, limit: int = 20) -> list:
    """
    Returns a list of medicines available in a store.

    Use when the user asks for:
    - Medicine catalog
    - Drug list
    - What products are available

    This tool provides descriptive medicine details, not quantities.
    """

    session = SessionLocal()
    try:
        meds = (
            session.query(Medicine)
            .filter(Medicine.storeId == store_id)
            .order_by(Medicine.createdAt.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "brand_name": decrypt_cell(m.brandName),
                "generic_name": decrypt_cell(m.genericName) if m.genericName else None,
                "strength": decrypt_cell(m.strength) if m.strength else None,
                "category": decrypt_cell(m.category) if m.category else None,
            }
            for m in meds
        ]
    finally:
        session.close()

@tool
def store_search_medicines(query: str, store_id: str = "") -> list:
    """
    Searches for medicines by brand name or generic name within the store.
    
    Args:
        query: The name of the medicine to search for (e.g., "Dolo", "Metformin").
        store_id: The UUID of the store. (LLM: Must be provided from context).
    """
    # Safety check for missing ID
    if not store_id:
        return [{"error": "Store ID is missing. Please try again."}]

    session = SessionLocal()
    try:
        meds = session.query(Medicine).filter(Medicine.storeId == store_id).limit(100).all()
        
        results = []
        search_q = query.lower().strip()
        
        for m in meds:
            b_name = decrypt_cell(m.brandName).lower()
            g_name = decrypt_cell(m.genericName).lower() if m.genericName else ""
            
            # Simple substring match
            if search_q in b_name or (g_name and search_q in g_name):
                stock = session.query(func.sum(InventoryBatch.qtyAvailable))\
                    .filter(InventoryBatch.medicineId == m.id).scalar() or 0
                
                results.append({
                    "brand": b_name,
                    "generic": g_name,
                    "sku": m.sku,
                    "total_available": int(stock)
                })
        
        if not results:
            return [{"message": f"No medicines found matching '{query}'"}]
            
        return results[:5] 
    finally:
        session.close()


@tool
def store_low_stock_medicines(store_id: str, threshold: int = 15) -> dict:
    """
    Identifies medicines in a store whose total available quantity
    is at or below a given threshold.

    Use for:
    - Low stock alerts
    - Reorder planning
    - Inventory risk analysis
    """

    session = SessionLocal()
    try:
        rows = (
            session.query(
                Medicine.brandName,
                func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0).label("qty")
            )
            .join(InventoryBatch, InventoryBatch.medicineId == Medicine.id)
            .filter(Medicine.storeId == store_id)
            .group_by(Medicine.id)
            .having(func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0) <= threshold)
            .all()
        )

        return {
            decrypt_cell(name): int(qty)
            for name, qty in rows
        }
    finally:
        session.close()


@tool
def store_expiring_batches(store_id: str, days: int = 30) -> list:
    """
    Returns inventory batches that are approaching expiry.

    Use when the user wants:
    - Expiry warnings
    - FEFO planning
    - Waste reduction insights

    Days parameter defines the expiry window.
    """

    session = SessionLocal()
    try:
        cutoff = datetime.utcnow() + timedelta(days=days)

        rows = (
            session.query(InventoryBatch, Medicine)
            .join(Medicine, Medicine.id == InventoryBatch.medicineId)
            .filter(
                InventoryBatch.storeId == store_id,
                InventoryBatch.expiryDate <= cutoff
            )
            .order_by(InventoryBatch.expiryDate.asc())
            .all()
        )

        return [
            {
                "medicine": decrypt_cell(m.brandName),
                "batch_id": b.id,
                "qty_available": b.qtyAvailable,
                "expiry_date": b.expiryDate.isoformat(),
            }
            for b, m in rows
        ]
    finally:
        session.close()


@tool
def store_recent_stock_activity(store_id: str, limit: int = 10) -> list:
    """
    Returns recent stock movements for a store.

    Use for:
    - Auditing
    - Operational tracking
    - Understanding recent inventory changes
    """

    session = SessionLocal()
    try:
        rows = (
            session.query(StockMovement, Medicine)
            .join(Medicine, Medicine.id == StockMovement.medicineId)
            .filter(StockMovement.storeId == store_id)
            .order_by(StockMovement.createdAt.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "medicine": decrypt_cell(m.brandName),
                "change": sm.delta,
                "reason": sm.reason,
                "timestamp": sm.createdAt.isoformat(),
            }
            for sm, m in rows
        ]
    finally:
        session.close()


@tool
def store_find_substitutes(medicine_name: str, store_id: str = "") -> list:
    """
    Finds alternative medicines (substitutes) with the SAME Generic Name but different brands.
    Use this when a user asks for a specific brand that is out of stock.
    """
    if not store_id: return [{"error": "Store ID missing"}]
    
    session = SessionLocal()
    try:
        # 1. Find target medicine generic name
        target_med = session.query(Medicine).filter(
            Medicine.storeId == store_id, 
            func.lower(Medicine.brandName) == medicine_name.lower().strip()
        ).first()
        
        if not target_med:
            return [{"error": f"Medicine '{medicine_name}' not found."}]
            
        target_generic = decrypt_cell(target_med.genericName)
        if not target_generic or target_generic == "Unknown":
            return [{"error": "No generic composition found for this medicine."}]

        # 2. Find substitutes
        # (Fetching all to decrypt in python - straightforward approach)
        all_meds = session.query(Medicine).filter(Medicine.storeId == store_id).all()
        valid_subs = []
        
        for sub in all_meds:
            if sub.id == target_med.id: continue # Skip same med
            
            g_name = decrypt_cell(sub.genericName)
            if g_name and g_name.lower() == target_generic.lower():
                # Check stock
                stock = session.query(func.sum(InventoryBatch.qtyAvailable))\
                    .filter(InventoryBatch.medicineId == sub.id).scalar() or 0
                
                if stock > 0:
                    valid_subs.append({
                        "brand": decrypt_cell(sub.brandName),
                        "generic": g_name,
                        "available_units": int(stock),
                        "price": float(session.query(InventoryBatch.mrp).filter(InventoryBatch.medicineId == sub.id).first()[0] or 0)
                    })
        
        return valid_subs if valid_subs else [{"message": "No in-stock substitutes found."}]
    finally:
        session.close()


@tool
def store_suggest_fefo_batch(medicine_name: str, qty_needed: int = 1, store_id: str = "") -> dict:
    """
    Suggests which batch to pick based on FEFO (First Expired, First Out).
    Use this when a pharmacist is selling a drug and needs to know which box to take.
    """
    if not store_id: return {"error": "Store ID missing"}

    session = SessionLocal()
    try:
        med = session.query(Medicine).filter(
            Medicine.storeId == store_id,
            func.lower(Medicine.brandName) == medicine_name.lower().strip()
        ).first()
        
        if not med: return {"error": "Medicine not found"}

        batches = (
            session.query(InventoryBatch)
            .filter(InventoryBatch.storeId == store_id, InventoryBatch.medicineId == med.id, InventoryBatch.qtyAvailable > 0)
            .order_by(InventoryBatch.expiryDate.asc()) # FEFO Logic
            .all()
        )
        
        if not batches: return {"status": "Out of Stock"}

        selected = []
        remaining = qty_needed
        for b in batches:
            if remaining <= 0: break
            take = min(b.qtyAvailable, remaining)
            selected.append({
                "batch": decrypt_cell(b.batchNumber),
                "expiry": b.expiryDate.strftime("%Y-%m-%d"),
                "location": decrypt_cell(b.location),
                "qty": take
            })
            remaining -= take
            
        return {"medicine": medicine_name, "strategy": "FEFO", "batches": selected}
    finally:
        session.close()
        

@tool
def store_sales_analytics(store_id: str = "", days: int = 7) -> dict:
    """
    Returns accurate sales revenue from the Sale table for the last N days.
    
    Args:
        store_id: The UUID of the store.
        days: Number of days to look back (default 7).
    """
    if not store_id:
        return {"error": "Store ID is missing."}

    session = SessionLocal()
    try:
        cutoff = datetime.utcnow() - timedelta(days=days)
        stats = (
            session.query(
                func.count(Sale.id),
                func.sum(Sale.totalValue)
            )
            .filter(Sale.storeId == store_id, Sale.createdAt >= cutoff)
            .first()
        )
        return {
            "period_days": days,
            "total_transactions": stats[0] or 0,
            "total_revenue": float(stats[1] or 0)
        }
    finally:
        session.close()

@tool
def supplier_view_requests(supplier_id: str) -> list:
    """
    Returns new purchase orders sent by stores to this supplier.
    Use when supplier asks 'Do I have any new orders?'.
    """
    session = SessionLocal()
    try:
        reqs = (
            session.query(SupplierRequest, Store)
            .join(Store, Store.id == SupplierRequest.storeId)
            .filter(SupplierRequest.supplierId == supplier_id)
            .order_by(SupplierRequest.createdAt.desc())
            .limit(5)
            .all()
        )
        return [
            {
                "store": decrypt_cell(s.name),
                "status": r.status,
                "message": r.message,
                "date": r.createdAt.strftime("%Y-%m-%d")
            }
            for r, s in reqs
        ]
    finally:
        session.close()

@tool
def store_my_suppliers(store_id: str = "") -> list:
    """
    Lists the names of suppliers linked to this store.
    
    Args:
        store_id: The UUID of the store.
    """
    if not store_id:
        return ["Error: Store ID missing"]

    session = SessionLocal()
    try:
        links = session.query(SupplierStore).filter(SupplierStore.storeId == store_id).all()
        names = []
        for link in links:
            sup = session.query(Supplier).get(link.supplierId)
            if sup:
                names.append(decrypt_cell(sup.name))
        return names
    finally:
        session.close()


# SUPPLIER TOOLS

@tool
def supplier_recent_uploads(supplier_id: str, limit: int = 10) -> list:
    """
    Returns recent upload jobs performed by a supplier.

    Use when supplier wants:
    - Upload status
    - Processing results
    - Operational visibility
    """

    session = SessionLocal()
    try:
        uploads = (
            session.query(Upload)
            .filter(Upload.metadata_json["uploaded_by_supplier"].astext == supplier_id)
            .order_by(Upload.createdAt.desc())
            .limit(limit)
            .all()
        )

        return [
            {
                "upload_id": u.id,
                "status": u.status,
                "created_at": u.createdAt.isoformat(),
            }
            for u in uploads
        ]
    finally:
        session.close()


@tool
def supplier_served_stores(supplier_id: str) -> list:
    """
    Lists stores that have received stock from this supplier.

    Use for:
    - Relationship tracking
    - Business analytics
    - Supplier performance insights
    """

    session = SessionLocal()
    try:
        stores = (
            session.query(Store)
            .join(StockMovement, StockMovement.storeId == Store.id)
            .filter(StockMovement.note.contains(supplier_id))
            .distinct()
            .all()
        )

        return [store.name for store in stores]
    finally:
        session.close()



# SUPER ADMIN TOOLS

@tool
def admin_platform_overview() -> dict:
    """
    Returns a high-level snapshot of the entire platform.

    Use for:
    - Executive dashboards
    - System health overview
    - Admin monitoring
    """

    session = SessionLocal()
    try:
        return {
            "total_stores": session.query(Store).count(),
            "total_medicines": session.query(Medicine).count(),
            "total_inventory_units": int(
                session.query(func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0)).scalar()
            ),
        }
    finally:
        session.close()


@tool
def admin_low_stock_overview(threshold: int = 10) -> dict:
    """
    Identifies stores across the platform whose total available inventory
    is below or equal to a threshold.

    Use for:
    - Platform-wide risk monitoring
    - Proactive intervention
    - Escalation workflows
    """

    session = SessionLocal()
    try:
        rows = (
            session.query(
                Store.name,
                func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0).label("qty")
            )
            .join(InventoryBatch, InventoryBatch.storeId == Store.id)
            .group_by(Store.id, Store.name)
            .having(func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0) <= threshold)
            .all()
        )

        return {
            store_name: int(qty)
            for store_name, qty in rows
        }
    finally:
        session.close()


@tool
def admin_medicines_per_store() -> dict:
    """
    Returns medicine distribution across stores.

    Use for:
    - Capacity planning
    - Store comparison
    - Growth analysis
    """

    session = SessionLocal()
    try:
        rows = (
            session.query(Store.name, func.count(Medicine.id))
            .join(Medicine, Medicine.storeId == Store.id)
            .group_by(Store.id, Store.name)
            .all()
        )

        return {
            store_name: count
            for store_name, count in rows
        }
    finally:
        session.close()

@tool
def admin_audit_logs(limit: int = 5) -> list:
    """
    Fetches the most recent system-wide critical audit logs.
    Use this to check for security issues or failed uploads.
    """
    session = SessionLocal()
    try:
        logs = session.query(AuditLog).order_by(AuditLog.createdAt.desc()).limit(limit).all()
        return [
            {"action": decrypt_cell(l.action), "resource": decrypt_cell(l.resource), "time": l.createdAt.isoformat()} 
            for l in logs
        ]
    finally:
        session.close()

@tool
def admin_user_stats() -> dict:
    """
    Returns detailed statistics about the platform's users (Excluding Super Admins).
    Use this when the admin asks 'How many users do we have?' or 'User growth'.
    """
    session = SessionLocal()
    try:
        # Simple filter: Exclude anyone explicitly marked as SUPERADMIN
        base_query = session.query(User).filter(User.globalRole != 'SUPERADMIN')

        total = base_query.count()
        active = base_query.filter(User.isActive == True).count()
        
        last_30_days = datetime.utcnow() - timedelta(days=30)
        new_users = base_query.filter(User.createdAt >= last_30_days).count()
        
        return {
            "total_users": total,
            "active_users": active,
            "inactive_users": total - active,
            "new_users_last_30_days": new_users
        }
    finally:
        session.close()

@tool
def admin_supplier_stats() -> dict:
    """
    Returns statistics about the platform's suppliers.
    Use this when the admin asks 'How many suppliers are there?'.
    """
    session = SessionLocal()
    try:
        total = session.query(Supplier).count()
        active = session.query(Supplier).filter(Supplier.isActive == True).count()
        
        # Get list of top 5 most recent suppliers
        recent = session.query(Supplier).order_by(Supplier.createdAt.desc()).limit(5).all()
        recent_names = [decrypt_cell(s.name) for s in recent]

        return {
            "total_suppliers": total,
            "active_suppliers": active,
            "recent_suppliers": recent_names
        }
    finally:
        session.close()

@tool
def admin_store_stats() -> dict:
    """
    Returns detailed statistics about the platform's stores.
    Use this when the admin asks 'How many stores are there?' or 'Store count'.
    """
    session = SessionLocal()
    try:
        total = session.query(Store).count()
        active = session.query(Store).filter(Store.isActive == True).count()
        
        recent = session.query(Store).order_by(Store.createdAt.desc()).limit(5).all()
        recent_names = [decrypt_cell(s.name) for s in recent]

        return {
            "total_stores": total,
            "active_stores": active,
            "inactive_stores": total - active,
            "newest_stores": recent_names
        }
    finally:
        session.close()


@tool
def admin_platform_deep_insight(limit: int = 20) -> dict:
    """
    Generates a 'Fat JSON' report for the platform, combining Inventory, Suppliers, AND Sales Revenue.
    
    Args:
        limit: Max number of stores to analyze (default 20).
        
    Returns:
        A dict containing 'system_summary' (total revenue/users) and 'stores' (detailed per-store metrics).
    """
    session = SessionLocal()
    try:
        # Fetch Store Structure + Inventory + Owner 
        base_results = (
            session.query(
                Store.id,
                Store.name,
                Store.slug,
                Store.isActive,
                Store.createdAt,
                User.email.label("owner_email"),
                User.isActive.label("owner_active"),
                func.count(func.distinct(Medicine.id)).label("total_medicines"),
                func.count(func.distinct(SupplierStore.supplierId)).label("linked_suppliers"),
                func.coalesce(func.sum(InventoryBatch.qtyAvailable), 0).label("total_units"),
                func.coalesce(func.sum(InventoryBatch.qtyAvailable * InventoryBatch.mrp), 0).label("stock_value")
            )
            .outerjoin(UserStoreRole, and_(UserStoreRole.storeId == Store.id, UserStoreRole.role == "STORE_OWNER"))
            .outerjoin(User, User.id == UserStoreRole.userId)
            .outerjoin(Medicine, Medicine.storeId == Store.id)
            .outerjoin(InventoryBatch, InventoryBatch.storeId == Store.id)
            .outerjoin(SupplierStore, SupplierStore.storeId == Store.id)
            .group_by(Store.id, User.email, User.isActive)
            .limit(limit)
            .all()
        )

        #  Fetch Sales Revenue Separately
        sales_results = (
            session.query(
                Sale.storeId,
                func.count(Sale.id).label("txn_count"),
                func.sum(Sale.totalValue).label("revenue")
            )
            .group_by(Sale.storeId)
            .all()
        )
        sales_map = {
            row.storeId: {"revenue": float(row.revenue or 0), "txns": row.txn_count} 
            for row in sales_results
        }

        # Merge & Build Fat JSON
        store_reports = []
        total_platform_revenue = 0.0
        total_platform_inventory_val = 0.0

        for r in base_results:
            # Get sales data from our map (or default to 0)
            s_data = sales_map.get(r.id, {"revenue": 0.0, "txns": 0})
            
            total_platform_revenue += s_data["revenue"]
            total_platform_inventory_val += float(r.stock_value)

            store_reports.append({
                "store_name": decrypt_cell(r.name),
                "store_slug": r.slug,
                "status": "Active" if r.isActive else "Inactive",
                "owner": decrypt_cell(r.owner_email) if r.owner_email else "Unclaimed",
                "inventory": {
                    "skus": r.total_medicines,
                    "units": int(r.total_units),
                    "value_at_mrp": float(r.stock_value)
                },
                "sales": {
                    "total_revenue": s_data["revenue"],
                    "transaction_count": s_data["txns"]
                },
                "suppliers": r.linked_suppliers
            })

        # ---Final Output Structure
        return {
            "platform_summary": {
                "total_stores_analyzed": len(store_reports),
                "total_platform_revenue": total_platform_revenue,
                "total_platform_stock_value": total_platform_inventory_val
            },
            "stores": store_reports
        }

    finally:
        session.close()


# TOOL REGISTRY
STORE_TOOLS = [
    store_inventory_summary,
    store_list_medicines,
    store_low_stock_medicines,
    store_expiring_batches,
    store_recent_stock_activity,
    store_sales_analytics,
    store_my_suppliers,  
    store_search_medicines,
    store_find_substitutes,
    store_suggest_fefo_batch,
    send_email,
]

SUPPLIER_TOOLS = [
    supplier_recent_uploads,
    supplier_view_requests,
    supplier_served_stores,
    send_email,
]

ADMIN_TOOLS = [
    admin_platform_overview,
    admin_low_stock_overview,
    admin_medicines_per_store,
    admin_audit_logs,
    admin_user_stats,
    admin_supplier_stats,
    admin_platform_deep_insight,
    admin_store_stats,
    send_email,
]


ROLE_TOOL_MAP = {
    "STORE_OWNER": STORE_TOOLS,
    "SUPPLIER": SUPPLIER_TOOLS,
    "SUPERADMIN": ADMIN_TOOLS,
}


graph_builder = StateGraph(State)

llm = ChatOpenAI(base_url=BASE_URL, model=MODEL_NAME, api_key=API_KEY)

def get_system_prompt(state: State| None) -> str:
    """
    Generates the system instruction, injecting the user's email so the LLM knows it.
    """
    role = state["role"]
    email = state["user_email"]
    user_id = state["user_id"]
    store_id = state["store_id"]
    supplier_id = state["supplier_id"]

    prompt = f"""
You are DOSE, the pharmacy AI assistant for SynapStore.

CURRENT CONTEXT:
- User Role: {role}
- User Email: {email}
- User Id: {user_id}
- Store_Id: {store_id}
- Supplier_Id: {supplier_id}

IMPORTANT INFO:
if Store_id is empty that means the user is a SUPPLIER
if Supplier_id is empty that mean the user is a STORE_OWNER
if both Store_id and Supplier_id are empty and the User Role is SUPERADMIN that means the user a SUPERADMIN
GUIDELINES:
1. USE TOOLS: If the user asks for data (inventory, sales, logs) or to SEND AN EMAIL, call the tool.
2. GUARDRAILS: You are a PHARMACY ASSISTANT. 
   - If the user asks about medicines, inventory, or sales: HELP THEM.
   - If the user asks about unrelated topics (politics, general knowledge, coding): 
     REFUSE POLITELY. Say: "I am designed only to assist with pharmacy operations."
3. EMAIL REQUESTS: 
   - If the user asks to "email me" or "send this to me", call the `send_email` tool with `email={email}`..
4. CHIT-CHAT: If the user asks silly questions or greetings, answer directly without tools.
5. SECURITY: You are restricted to the tools available to a {role}.
GUIDELINES:

"""
    return prompt


def chatbot(state: State):
    user_role = state["role"]
    
    allowed_tools = ROLE_TOOL_MAP.get(user_role, [])
    model_with_tools = llm.bind_tools(allowed_tools)
    
    system_msg = get_system_prompt(state)
    messages = [{"role": "system", "content": system_msg}] + state["messages"]
    reply = model_with_tools.invoke(messages)
    return {"messages": [reply]}


all_tools = STORE_TOOLS + SUPPLIER_TOOLS + ADMIN_TOOLS

unique_tools_map = {t.name: t for t in all_tools}

global_tool_node = ToolNode(tools=list(unique_tools_map.values()))


graph_builder.add_node("chatbot", chatbot)
graph_builder.add_node("tools", global_tool_node)


graph_builder.add_edge(START, "chatbot")
graph_builder.add_conditional_edges("chatbot", tools_condition, "tools")
graph_builder.add_edge("tools", "chatbot")


@asynccontextmanager
async def lifespan(app: FastAPI):
    # Startup code
    # checkpointer_cm = AsyncPostgresSaver.from_conn_string(DB_URI)
    # postgres_memory = await checkpointer_cm.__aenter__()
    # await postgres_memory.setup()

    # graph = graph_builder.compile(checkpointer=postgres_memory)

    # # Stores in app.state
    # app.state.checkpointer_cm = checkpointer_cm
    # app.state.postgres_memory = postgres_memory
    # app.state.graph = graph

    yield # Run the application

    # Shutdown code
    # await checkpointer_cm.__aexit__(None, None, None)


def encrypt_cell(plaintext: str) -> str:
    if plaintext is None:
        return None

    aesgcm = AESGCM(SECRET_KEY)
    nonce = os.urandom(12)

    ct = aesgcm.encrypt(
        nonce,
        plaintext.encode("utf-8"),
        None
    )

    return base64.b64encode(nonce + ct).decode("utf-8")


def decrypt_cell(ciphertext: str | None) -> str:
    if not ciphertext:
        return "Unknown"
    try:
        raw = base64.b64decode(ciphertext)
        nonce = raw[:12]
        ct = raw[12:]
        aesgcm = AESGCM(SECRET_KEY)
        plain = aesgcm.decrypt(nonce, ct, None)
        return plain.decode("utf-8")
    except Exception as e:
        print(f"Decryption failed for value: {ciphertext} | Error: {e}")
        return "[Encrypted/Invalid]"


def clean_value(val, *, default=None):
    """
    Normalizes Excel cell values.
    - None / NaN / 'nan' / ''  → default
    - else → stripped string
    """
    if val is None:
        return default

    if isinstance(val, float) and pd.isna(val):
        return default

    s = str(val).strip()
    if s == "" or s.lower() == "nan":
        return default

    return s




app = FastAPI(title="Zenith-Core",
              description="Backend service for Zenith Uploaded Files Preprocessing, ChatBot & Forecasting Model",
              version="1.0.0",
              lifespan=lifespan)


app.middleware("http")(jwt_auth_middleware)


FRIENDLY_TO_KEY = {
    "medicine sku": "medicine_sku",
    "ndc": "ndc",
    "brand name": "brand_name",
    "generic name": "generic_name",
    "dosage form": "dosage_form",
    "strength": "strength",
    "unit of measure": "uom",
    "category": "category",
    "batch number": "batch_number",
    "quantity received": "qty_received",
    "expiry date": "expiry_date",
    "purchase price": "purchase_price",
    "mrp": "mrp",
    "received at": "received_at",
    "location": "location",
    "notes": "notes",
}

EXPECTED_COLUMNS = [
    "medicine_sku", "ndc", "brand_name", "generic_name", "dosage_form",
    "strength", "uom", "category", "batch_number", "qty_received",
    "expiry_date", "purchase_price", "mrp", "received_at", "location", "notes"
]

def normalize_columns(df: pd.DataFrame) -> pd.DataFrame:
    cols = []
    for c in df.columns:
        c2 = str(c).strip().lower()
        # map friendly to machine key if possible
        if c2 in FRIENDLY_TO_KEY:
            cols.append(FRIENDLY_TO_KEY[c2])
        else:
            # fallback: replace spaces/hyphens with underscore
            cols.append(c2.replace(" ", "_").replace("-", "_"))
    df.columns = cols
    return df


def new_uuid() -> str:
    return str(uuid.uuid4())

def get_user_email(session: Session, user_id: str) -> str:
    user = session.query(User).get(user_id)
    if not user or not user.email:
        raise RuntimeError("User email not found")

    return decrypt_cell(user.email)


def get_store_owner_email(session: Session, store_id: str) -> str:
    """
    Resolve Store Owner email via UserStoreRole → User
    Priority: OWNER → ADMIN
    """

    role = (
        session.query(UserStoreRole)
        .filter(
            UserStoreRole.storeId == store_id,
            UserStoreRole.role.in_(["STORE_OWNER"])
        )
        .order_by(
            UserStoreRole.role.asc()
        )
        .first()
    )

    if not role:
        raise RuntimeError("No store owner/admin mapped to store")

    user = session.query(User).get(role.userId)
    if not user or not user.email:
        raise RuntimeError("Store user email not found")

    return decrypt_cell(user.email)


def get_supplier_user_email(session: Session, supplier_id: str) -> str:
    supplier = session.query(Supplier).get(supplier_id)
    if not supplier or not supplier.userId:
        raise RuntimeError("Supplier user not linked")

    user = session.query(User).get(supplier.userId)
    if not user or not user.email:
        raise RuntimeError("Supplier user email not found")

    return decrypt_cell(user.email)


def send_upload_notifications(
    *,
    upload_id: str,
    store_id: str,
    supplier_id: str | None,
    processed: int,
    errors: int,
):
    session = SessionLocal()
    try:
        upload = session.query(Upload).get(upload_id)
        store = session.query(Store).get(store_id)
        supplier = session.query(Supplier).get(supplier_id) if supplier_id else None

        store_name = decrypt_cell(store.name)
        store_email = get_store_owner_email(session, store_id)

        supplier_name = decrypt_cell(supplier.name) if supplier else "Unknown Supplier"
        supplier_email = (
            get_supplier_user_email(session, supplier_id)
            if supplier_id else None
        )

        items = {
            "Medicines Uploaded": processed,
        }
        if errors > 0:
            items["Errors"] = errors

        Thread(
            target=send_storeowner_dispatch_email,
            kwargs={
                "to_email": store_email,
                "store_name": store_name,
                "supplier_name": supplier_name,
                "invoice_id": upload.id,
                "items": items,
                "expected_delivery": "Already Delivered",
            },
            daemon=True,
        ).start()

        if supplier_email:
            Thread(
                target=send_storeowner_dispatch_email,
                kwargs={
                    "to_email": supplier_email,
                    "store_name": store_name,
                    "supplier_name": supplier_name,
                    "invoice_id": upload.id,
                    "items": items,
                    "expected_delivery": "Already Delivered",
                },
                daemon=True,
            ).start()

    except Exception as e:
        if supplier_id:
            supplier_email = get_supplier_user_email(session, supplier_id)

            Thread(
                target=send_supplier_failure_email,
                kwargs={
                    "to_email": supplier_email,
                    "store_name": store_name,
                    "store_email": store_email,
                    "supplier_name": supplier_name,
                    "invoice_id": upload.id,
                    "failure_reason": str(e),
                },
                daemon=True,
            ).start()

    finally:
        session.close()



def log_upload_activity(
    session: Session,
    *,
    store_id: str,
    upload_id: str,
    processed: int,
    errors: int,
):
    session.add(
        ActivityLog(
            id=new_uuid(),
            storeId=store_id,
            action=encrypt_cell(
                f"Supplier upload completed. Added={processed}, Errors={errors}"
            ),
            createdAt=datetime.utcnow(),
        )
    )

    session.add(
        AuditLog(
            id=new_uuid(),
            storeId=store_id,
            resource=encrypt_cell("SUPPLIER_UPLOAD"),
            action=encrypt_cell(
                f"UPLOAD_ID={upload_id} STATUS=COMPLETED"
            ),
            createdAt=datetime.utcnow(),
        )
    )



def safe_parse_datetime(series: pd.Series) -> pd.Series:
    """
    Cleans garbage timestamps and parses safely.
    - Removes invalid timezone suffixes
    - Forces datetime parsing
    - Returns NaT for invalid rows
    """
    def clean(val):
        if pd.isna(val):
            return None
        s = str(val).strip()

        # remove random timezone junk like IY, KI, etc
        s = re.sub(r"[A-Z]{2,5}$", "", s)

        return s.strip()

    cleaned = series.apply(clean)

    return pd.to_datetime(
        cleaned,
        errors="coerce",
        utc=False
    )


def update_upload_progress(
    upload_id: str,
    total: int,
    processed: int,
    errors: int,
    inserted: int,
    phase: str = "PROCESSING",
):
    progress_session = SessionLocal()
    try:
        percent = round(((processed + errors) / max(total, 1)) * 100)

        upload = progress_session.query(Upload).get(upload_id)
        if upload:
            upload.metadata_json = {
                "totalRows": total,
                "processedRows": processed,
                "insertedRows": inserted,
                "errorRows": errors,
                "progressPercent": percent,
                "phase": phase,
            }
            progress_session.commit()
    finally:
        progress_session.close()



def process_supplier_medicine_upload(
    upload_id: str,
    store_id: str,
    supplier_id: Optional[str],
    file_path: str
):
    """
    Background job:
    - Reads supplier Excel
    - Cleans + validates
    - Skips expired medicines
    - Inserts Medicine, InventoryBatch, StockMovement
    - Updates progress smoothly (no decimal spam)
    - Notifies uploader on completion
    """

    session: Session = SessionLocal()
    processed = 0
    inserted = 0
    errors = 0
    messages: List[str] = []

    try:
        upload = session.get(Upload, upload_id)
        if not upload:
            return

        # Load & normalize Excel
        df = pd.read_excel(file_path)
        df = normalize_columns(df)

        missing = set(EXPECTED_COLUMNS) - set(df.columns)
        if missing:
            raise ValueError(f"Missing columns: {', '.join(sorted(missing))}")

        # Cleaning & parsing (safe + strict)
        df["medicine_sku"] = df["medicine_sku"].astype(str).str.strip().str.lower()
        df["ndc"] = df["ndc"].astype(str).str.strip().str.lower().replace({"nan": None})

        df["qty_received"] = (
            pd.to_numeric(df["qty_received"], errors="coerce")
            .fillna(0)
            .astype(int)
        )

        df["expiry_date"] = pd.to_datetime(
            df["expiry_date"], errors="coerce"
        )

        df["received_at"] = pd.to_datetime(
            df["received_at"], errors="coerce"
        ).fillna(datetime.utcnow())

        df["purchase_price"] = pd.to_numeric(df["purchase_price"], errors="coerce")
        df["mrp"] = pd.to_numeric(df["mrp"], errors="coerce")

        # Drop invalid rows early
        df = df[
            (df["qty_received"] > 0)
            & (df["expiry_date"].notna())
        ]

        # Remove expired medicines
        today = datetime.utcnow()
        df = df[df["expiry_date"] > today]

        total_rows = len(df)

        # Init progress
        upload.status = "PROCESSING"
        upload.metadata_json = {
            "totalRows": total_rows,
            "processedRows": 0,
            "insertedRows": 0,
            "errorRows": 0,
            "progressPercent": 0,
            "phase": "PROCESSING",
        }
        session.commit()

        last_reported_percent = -1

        # Cache existing medicines
        meds = session.query(Medicine).filter(Medicine.storeId == store_id).all()
        sku_map = {m.sku.lower(): m.id for m in meds if m.sku}
        ndc_map = {m.ndc.lower(): m.id for m in meds if m.ndc}

        created_keys: Dict[tuple, str] = {}

        # Main loop
        for idx, row in df.iterrows():
            try:
                now = datetime.utcnow()
                sku = row["medicine_sku"]
                ndc = row.get("ndc")

                med_id = sku_map.get(sku) or (ndc_map.get(ndc) if ndc else None)

               
                # Create medicine if needed
                if not med_id:
                    key = (sku, row.get("dosage_form"), row.get("strength"))
                    if key in created_keys:
                        med_id = created_keys[key]
                    else:
                        med = Medicine(
                            id=new_uuid(),
                            storeId=store_id,
                            sku=clean_value(sku),
                            ndc=clean_value(ndc),
                            brandName=encrypt_cell(
                                clean_value(row.get("brand_name"))
                                or clean_value(row.get("generic_name"))
                                or "UNKNOWN"
                            ),
                            genericName=encrypt_cell(clean_value(row.get("generic_name")))
                            if clean_value(row.get("generic_name")) else None,
                            dosageForm=encrypt_cell(clean_value(row.get("dosage_form")))
                            if clean_value(row.get("dosage_form")) else None,
                            strength=encrypt_cell(
                                clean_value(row.get("strength"), default="Not Specified")
                            ),
                            uom=clean_value(row.get("uom")),
                            category=encrypt_cell(clean_value(row.get("category")))
                            if clean_value(row.get("category")) else None,
                            isActive=True,
                            createdAt=now,
                            updatedAt=now,
                        )
                        session.add(med)
                        session.flush()

                        med_id = med.id
                        created_keys[key] = med_id
                        if sku:
                            sku_map[sku] = med_id
                        if ndc:
                            ndc_map[ndc] = med_id

                
                # Inventory batch
                inv = InventoryBatch(
                    id=new_uuid(),
                    storeId=store_id,
                    medicineId=med_id,
                    batchNumber=encrypt_cell(row.get("batch_number"))
                    if clean_value(row.get("batch_number")) else None,
                    qtyReceived=int(row["qty_received"]),
                    qtyAvailable=int(row["qty_received"]),
                    expiryDate=row["expiry_date"].to_pydatetime(),
                    purchasePrice=float(row["purchase_price"])
                    if not pd.isna(row["purchase_price"]) else None,
                    mrp=float(row["mrp"]) if not pd.isna(row["mrp"]) else None,
                    receivedAt=row["received_at"].to_pydatetime(),
                    location=encrypt_cell(row.get("location"))
                    if clean_value(row.get("location")) else None,
                    createdAt=now,
                    updatedAt=now,
                )

                session.add(inv)
                session.flush()

                # Stock movement (RECEIPT)
                session.add(
                    StockMovement(
                        id=new_uuid(),
                        storeId=store_id,
                        inventoryId=inv.id,
                        medicineId=med_id,
                        delta=int(row["qty_received"]),
                        reason="RECEIPT",
                        note=encrypt_cell(f"Supplier:{supplier_id}")
                        if supplier_id else None,
                        createdAt=now,
                    )
                )

                processed += 1
                inserted += 1

                # Throttled progress update
                current_percent = int(
                    ((processed + errors) * 100) / max(total_rows, 1)
                )

                if current_percent > last_reported_percent:
                    update_upload_progress(
                        upload_id=upload_id,
                        total=total_rows,
                        processed=processed,
                        errors=errors,
                        inserted=inserted,
                        phase="PROCESSING",
                    )
                    last_reported_percent = current_percent

            except Exception as exc:
                session.rollback()
                errors += 1
                if len(messages) < 50:
                    messages.append(f"Row {idx}: {str(exc)}")

        # Finalize
        upload.status = "APPLIED" if errors == 0 else "PREVIEW_READY"
        session.commit()

        update_upload_progress(
            upload_id=upload_id,
            total=total_rows,
            processed=processed,
            errors=errors,
            inserted=inserted,
            phase="COMPLETED",
        )

        Thread(
            target=send_upload_notifications,
            kwargs={
                "upload_id": upload_id,
                "store_id": store_id,
                "supplier_id": supplier_id,
                "processed": inserted,
                "errors": errors,
            },
            daemon=True,
        ).start()

        log_upload_activity(
            session=session,
            store_id=store_id,
            upload_id=upload_id,
            processed=inserted,
            errors=errors,
        )
        session.commit()

    except Exception as exc:
        session.rollback()
        upload = session.get(Upload, upload_id)
        if upload:
            upload.status = "FAILED"
            upload.metadata_json = {
                "processedRows": processed,
                "insertedRows": inserted,
                "errorRows": errors + 1,
                "phase": "FAILED",
                "messages": messages + [str(exc)],
            }
            session.commit()

    finally:
        session.close()
        try:
            os.remove(file_path)
        except Exception:
            pass



def get_daily_sales_df(session: Session, store_id: str, medicine_id: str) -> pd.DataFrame:
    rows = (
        session.query(
            func.date(StockMovement.createdAt).label("ds"),
            func.sum(-StockMovement.delta).label("y"),
        )
        .filter(
            StockMovement.storeId == store_id,
            StockMovement.medicineId == medicine_id,
            StockMovement.delta < 0,  # sales only
        )
        .group_by(func.date(StockMovement.createdAt))
        .order_by("ds")
        .all()
    )

    df = pd.DataFrame(rows, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].clip(lower=0)
    return df


def get_daily_price_df(session, store_id, medicine_id) -> pd.DataFrame:
    rows = (
        session.query(
            func.date(InventoryBatch.createdAt).label("ds"),
            func.avg(InventoryBatch.mrp).label("y"),
        )
        .filter(
            InventoryBatch.storeId == store_id,
            InventoryBatch.medicineId == medicine_id,
            InventoryBatch.mrp.isnot(None),
        )
        .group_by(func.date(InventoryBatch.createdAt))
        .order_by("ds")
        .all()
    )

    df = pd.DataFrame(rows, columns=["ds", "y"])
    df["ds"] = pd.to_datetime(df["ds"])
    df["y"] = df["y"].astype(float)
    return df




def get_inventory_snapshot(session, store_id, medicine_id):
    batches = (
        session.query(InventoryBatch)
        .filter(
            InventoryBatch.storeId == store_id,
            InventoryBatch.medicineId == medicine_id,
        )
        .all()
    )

    current_stock = sum(b.qtyAvailable for b in batches)

    expiry_map = {}
    for b in batches:
        if b.expiryDate:
            days = (b.expiryDate - datetime.utcnow()).days
            expiry_map[str(b.id)] = {
                "qty": b.qtyAvailable,
                "days_to_expiry": days,
            }

    return current_stock, expiry_map


def prophet_forecast_series(df: pd.DataFrame, days: int):
    model = Prophet(
        weekly_seasonality=True,
        yearly_seasonality=True,
        daily_seasonality=False,
    )
    model.fit(df)

    future = model.make_future_dataframe(periods=days)
    forecast = model.predict(future)

    return forecast


def build_plot_data(df: pd.DataFrame, forecast: pd.DataFrame, history_cutoff: pd.Timestamp):
    history = [
        {"date": d.strftime("%Y-%m-%d"), "qty": int(y)}
        for d, y in zip(df["ds"], df["y"])
    ]

    future = forecast[forecast["ds"] > history_cutoff]

    forecast_points = [
        {
            "date": row.ds.strftime("%Y-%m-%d"),
            "qty": int(max(0, row.yhat)),
        }
        for _, row in future.iterrows()
    ]

    confidence = [
        {
            "date": row.ds.strftime("%Y-%m-%d"),
            "low": int(max(0, row.yhat_lower)),
            "high": int(max(0, row.yhat_upper)),
        }
        for _, row in future.iterrows()
    ]

    return {
        "history": history,
        "forecast": forecast_points,
        "confidence": confidence,
        "cutoff_date": history_cutoff.strftime("%Y-%m-%d"),
    }


def detect_price_surge(price_df: pd.DataFrame):
    if len(price_df) < 8:
        return None

    prices = price_df["y"].tolist()

    baseline = mean(prices[-8:-4])
    recent = mean(prices[-4:])

    if baseline <= 0:
        return None

    pct = ((recent - baseline) / baseline) * 100

    if pct < 15:
        return None

    if pct >= 50:
        level = "CRITICAL"
    elif pct >= 30:
        level = "HIGH"
    else:
        level = "MEDIUM"

    return {
        "risk_level": level,
        "expected_increase_pct": round(pct, 2),
        "baseline_price": round(baseline, 2),
        "recent_price": round(recent, 2),
        "recommendation": "Stock up before supplier price hike",
    }


def build_price_plot_data(price_df: pd.DataFrame):
    return {
        "history": [
            {"date": d.strftime("%Y-%m-%d"), "qty": round(p, 2)}
            for d, p in zip(price_df["ds"], price_df["y"])
        ],
        "cutoff_date": price_df["ds"].max().strftime("%Y-%m-%d"),
    }


def project_price_series(price_df: pd.DataFrame, horizon_days: int):
    if len(price_df) < 5:
        return [], []

    last_price = price_df["y"].iloc[-1]

    # simple slope from last N points
    recent = price_df.tail(5)
    slope = (recent["y"].iloc[-1] - recent["y"].iloc[0]) / max(len(recent), 1)

    forecast = []
    confidence = []

    start_date = price_df["ds"].max()

    for i in range(1, horizon_days + 1):
        projected = max(0, last_price + slope * i)

        date = start_date + timedelta(days=i)

        forecast.append({
            "date": date.date().isoformat(),
            "qty": round(projected, 2),
        })

        confidence.append({
            "date": date.date().isoformat(),
            "low": round(projected * 0.95, 2),
            "high": round(projected * 1.05, 2),
        })

    return forecast, confidence


@app.post("/chat", response_model=ChatResponse, tags=["Chatbot"])
async def chat(body: ChatRequest, request: Request):
    user_ctx = request.state.user  

    role: str = user_ctx.role               # STORE_OWNER | SUPPLIER | SUPER_ADMIN
    user_id: str = user_ctx.user_id
    user_email: str = user_ctx.user_email
    store_id: str | None = getattr(user_ctx, "store_id", None)
    supplier_id: str | None = getattr(user_ctx, "supplier_id", None)

    if role not in {"STORE_OWNER", "SUPPLIER", "SUPERADMIN"}:
        raise HTTPException(status_code=403, detail="Invalid role")


    thread_id = body.thread_id or "default"

    async with AsyncPostgresSaver.from_conn_string(DB_URI) as postgres_memory:
        await postgres_memory.setup()
        graph = graph_builder.compile(checkpointer=postgres_memory)

        try:
            result = await graph.ainvoke(
                {
                    "messages": [
                        {"role": "user", "content": body.message}
                    ],
                    "role": role,
                    "user_id": user_id,
                    "store_id": store_id,
                    "supplier_id": supplier_id,
                    "user_email": user_email
                },
                config={
                    "configurable": {
                        "thread_id": thread_id
                    }
                },
            )

        except openai.BadRequestError as e:
            logger.error(
                f"Model error | role={role} | user_id={user_id} | thread={thread_id}: {e}"
            )
            raise HTTPException(
                status_code=502,
                detail="LLM upstream error",
            )


        reply = result["messages"][-1].content
        return ChatResponse(reply_markdown=reply)
        
        
@app.get("/templates/supplier-upload", tags=["Supplier"])
def download_supplier_upload_template():
    if not SUPPLIER_TEMPLATE_PATH.exists():
        raise HTTPException(status_code=500, detail="Supplier upload template not found on server.")
    
    filename = "supplier_upload_template.xlsx"
    return FileResponse(path=str(SUPPLIER_TEMPLATE_PATH),
                        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        filename=filename
                        )

class UploadResponse(BaseModel):
    upload_id: str
    message: str

@app.post("/supplier/upload", response_model=UploadResponse, tags=["Supplier"])
def supplier_upload(
    background_tasks: BackgroundTasks,
    store_slug: str = Query(..., description="Store slug (e.g. my-pharmacy-1)"),
    supplier_id: Optional[str] = Query(None, description="Supplier id (UUID) or supplier legacy id"),
    file: UploadFile = File(...),
):
    # resolve store
    db: Session = SessionLocal()
    try:
        store = db.query(Store).filter(Store.slug == store_slug).one_or_none()
        if not store:
            raise HTTPException(status_code=404, detail="Store not found")
        store_id = store.id

        # save file to disk
        file_bytes = file.file.read()
        upload_filename = f"{uuid.uuid4()}_{file.filename}"
        file_path = str(UPLOAD_STORE / upload_filename)
        with open(file_path, "wb") as f:
            f.write(file_bytes)

        # create Upload row
        upload = Upload(
            id=new_uuid(),
            storeId=store_id,
            filename=file.filename,
            status="PENDING",
            metadata_json={
                "original_filename": file.filename,
                "uploaded_by_supplier": supplier_id
            }
        )
        db.add(upload)
        db.commit()

        # schedule background processing
        background_tasks.add_task(process_supplier_medicine_upload, upload.id, store_id, supplier_id, file_path)

        return UploadResponse(upload_id=upload.id, message="Upload accepted and processing started.")
    finally:
        db.close()


@app.get("/supplier/upload/{upload_id}/status", tags=["Supplier"])
def upload_status(upload_id: str):
    db = SessionLocal()
    try:
        upload = db.query(Upload).get(upload_id)
        if not upload:
            raise HTTPException(404, "Upload not found")

        meta = upload.metadata_json or {}

        return {
            "uploadId": upload.id,
            "status": upload.status,
            "progressPercent": meta.get("progressPercent", 0),
            "processedRows": meta.get("processedRows", 0),
            "totalRows": meta.get("totalRows", 0),
            "errorRows": meta.get("errorRows", 0),
            "phase": meta.get("phase", "PENDING"),
            "createdAt": upload.createdAt.isoformat(),
            "updatedAt": upload.updatedAt.isoformat()
        }
    finally:
        db.close()


# @app.post("/forecast/inventory", response_model=ForecastResponse, tags=["Forecasting"])
# def forecast_inventory(req: ForecastRequest):
#     session = SessionLocal()

#     try:
#         # 1. Validate medicine
#         medicine = session.get(Medicine, req.medicine_id)
#         if not medicine:
#             raise HTTPException(404, "Medicine not found")

#         medicine_name = decrypt_cell(medicine.brandName)

#         # 2. Demand time series (sales)
#         sales_df = get_daily_sales_df(
#             session, req.store_id, req.medicine_id
#         )
#         print(f"length of the sales_df: {len(sales_df)}")
#         if len(sales_df) < 14:
#             raise HTTPException(400, "Not enough sales data for demand forecasting")

#         # 3. Price time series (MRP)
#         price_df = get_daily_price_df(
#             session, req.store_id, req.medicine_id
#         )
#         if len(price_df) < 10:
#             raise HTTPException(400, "Not enough price history for price forecasting")

#         # 4. Inventory snapshot
#         current_stock, expiry_map = get_inventory_snapshot(
#             session, req.store_id, req.medicine_id
#         )

#         # 5. Unified horizon
#         max_horizon = max(req.horizon_days)

#         # 6. Demand forecast
#         demand_forecast_df = prophet_forecast_series(
#             sales_df, max_horizon
#         )
#         demand_cutoff = sales_df["ds"].max()

#         demand_forecast = {}
#         reorder_quantity = {}
#         SAFETY_STOCK = 10

#         for h in req.horizon_days:
#             slice_df = demand_forecast_df.tail(h)
#             expected = int(slice_df["yhat"].clip(lower=0).sum())

#             demand_forecast[str(h)] = expected
#             reorder_quantity[str(h)] = max(
#                 0, expected + SAFETY_STOCK - current_stock
#             )

#         reorder_now = reorder_quantity[str(min(req.horizon_days))] > 0

#         # 7. Price forecast (SAME FLOW AS DEMAND)
#         price_forecast_df = prophet_forecast_series(
#             price_df, max_horizon
#         )
#         price_cutoff = price_df["ds"].max()

#         # 8. Price surge detection (derived insight)
#         baseline_price = price_df["y"].tail(7).mean()
#         future_price = price_forecast_df.tail(7)["yhat"].mean()

#         price_surge_risk = None
#         pct_change = ((future_price - baseline_price) / baseline_price) * 100

#         if pct_change >= 15:
#             price_surge_risk = PriceSurgeRisk(
#                 risk_level="HIGH",
#                 expected_increase_pct=round(pct_change, 2),
#                 recommendation="Stock up immediately before supplier price hike",
#                 baseline_price=round(baseline_price, 2),
#                 recent_price=round(future_price, 2),
#             )
#         elif pct_change >= 7:
#             price_surge_risk = PriceSurgeRisk(
#                 risk_level="MEDIUM",
#                 expected_increase_pct=round(pct_change, 2),
#                 recommendation="Consider early procurement to protect margins",
#                 baseline_price=round(baseline_price, 2),
#                 recent_price=round(future_price, 2),
#             )

#         # 9. Expiry & waste estimation
#         expiry_risk = {}
#         estimated_waste_units = 0
#         demand_30d = demand_forecast.get("30", 0)

#         for batch_id, info in expiry_map.items():
#             if info["days_to_expiry"] <= 30:
#                 expiry_risk[batch_id] = info["qty"]
#                 if info["qty"] > demand_30d:
#                     estimated_waste_units += info["qty"] - demand_30d

#         # 10. Plot-ready data (CLEAN & SYMMETRIC)
#         demand_plot = build_plot_data(
#             sales_df, demand_forecast_df, demand_cutoff
#         )

#         price_plot = build_plot_data(
#             price_df, price_forecast_df, price_cutoff
#         )

#         # 11. Response (FINAL CONTRACT)
#         return ForecastResponse(
#             medicine_name=medicine_name,
#             current_stock=current_stock,

#             demand_forecast=demand_forecast,
#             reorder_quantity=reorder_quantity,
#             reorder_now=reorder_now,

#             expiry_risk=expiry_risk,
#             estimated_waste_units=estimated_waste_units,

#             plot_data={
#                 "demand": demand_plot,
#                 "price": price_plot,
#             },

#             price_surge_risk=price_surge_risk,
#             price_plot_data=price_plot,  # optional duplicate for UI convenience
#         )

#     finally:
#         session.close()


@app.post("/forecast/inventory", response_model=ForecastResponse, tags=["Forecasting"])
def forecast_inventory(req: ForecastRequest):
    session = SessionLocal()

    try:
        # 1️⃣ Validate medicine
        medicine = session.get(Medicine, req.medicine_id)
        if not medicine:
            raise HTTPException(404, "Medicine not found")

        medicine_name = decrypt_cell(medicine.brandName)

        # 2️⃣ Demand time series (sales)
        sales_df = get_daily_sales_df(
            session, req.store_id, req.medicine_id
        )

        if len(sales_df) < 14:
            raise HTTPException(
                400, "Not enough sales data for demand forecasting"
            )

        # 3️⃣ Price time series (MRP history)
        price_df = get_daily_price_df(
            session, req.store_id, req.medicine_id
        )

        if len(price_df) < 5:
            raise HTTPException(
                400, "Not enough price history for price forecasting"
            )

        # 4️⃣ Inventory snapshot
        current_stock, expiry_map = get_inventory_snapshot(
            session, req.store_id, req.medicine_id
        )

        # 5️⃣ Unified horizon
        max_horizon = max(req.horizon_days)

        # ============================================================
        # 6️⃣ DEMAND FORECAST (Prophet)
        # ============================================================
        demand_forecast_df = prophet_forecast_series(
            sales_df, max_horizon
        )
        demand_cutoff = sales_df["ds"].max()

        demand_forecast = {}
        reorder_quantity = {}
        SAFETY_STOCK = 10

        for h in req.horizon_days:
            slice_df = demand_forecast_df.tail(h)
            expected = int(slice_df["yhat"].clip(lower=0).sum())

            demand_forecast[str(h)] = expected
            reorder_quantity[str(h)] = max(
                0, expected + SAFETY_STOCK - current_stock
            )

        reorder_now = reorder_quantity[str(min(req.horizon_days))] > 0

        # ============================================================
        # 7️⃣ PRICE FORECAST (DETERMINISTIC — NOT PROPHET)
        # ============================================================
        price_forecast, price_confidence = project_price_series(
            price_df, max_horizon
        )
        price_cutoff = price_df["ds"].max()

        # ============================================================
        # 8️⃣ PRICE SURGE DETECTION
        # ============================================================
        price_surge_risk = None

        if price_forecast:
            recent_price = price_df["y"].tail(5).mean()
            future_price = mean(p["qty"] for p in price_forecast[:5])

            pct_change = ((future_price - recent_price) / recent_price) * 100

            if pct_change >= 15:
                price_surge_risk = PriceSurgeRisk(
                    risk_level="HIGH",
                    expected_increase_pct=round(pct_change, 2),
                    recommendation="Stock up before supplier price hike",
                    baseline_price=round(recent_price, 2),
                    recent_price=round(future_price, 2),
                )
            elif pct_change >= 7:
                price_surge_risk = PriceSurgeRisk(
                    risk_level="MEDIUM",
                    expected_increase_pct=round(pct_change, 2),
                    recommendation="Consider early procurement to protect margins",
                    baseline_price=round(recent_price, 2),
                    recent_price=round(future_price, 2),
                )

        # ============================================================
        # 9️⃣ EXPIRY & WASTE ESTIMATION
        # ============================================================
        expiry_risk = {}
        estimated_waste_units = 0
        demand_30d = demand_forecast.get("30", 0)

        for batch_id, info in expiry_map.items():
            if info["days_to_expiry"] <= 30:
                expiry_risk[batch_id] = info["qty"]
                if info["qty"] > demand_30d:
                    estimated_waste_units += info["qty"] - demand_30d

        # ============================================================
        # 🔟 PLOT DATA (UI-READY)
        # ============================================================
        demand_plot = build_plot_data(
            sales_df, demand_forecast_df, demand_cutoff
        )

        price_plot = {
            "history": [
                {"date": d.strftime("%Y-%m-%d"), "qty": round(p, 2)}
                for d, p in zip(price_df["ds"], price_df["y"])
            ],
            "forecast": price_forecast,
            "confidence": price_confidence,
            "cutoff_date": price_cutoff.strftime("%Y-%m-%d"),
        }

        # ============================================================
        # ✅ FINAL RESPONSE
        # ============================================================
        return ForecastResponse(
            medicine_name=medicine_name,
            current_stock=current_stock,

            demand_forecast=demand_forecast,
            reorder_quantity=reorder_quantity,
            reorder_now=reorder_now,

            expiry_risk=expiry_risk,
            estimated_waste_units=estimated_waste_units,

            plot_data={
                "demand": demand_plot,
                "price": price_plot,
            },

            price_surge_risk=price_surge_risk,
            price_plot_data=price_plot,
        )

    finally:
        session.close()


        

if __name__ == "__main__":
    import uvicorn
    uvicorn.run("app:app", host="0.0.0.0", port=7860)