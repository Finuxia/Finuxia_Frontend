import { useEffect, useState } from "react";
import { api } from "../lib/api";

/**
 * The insurers, their products and their funds that the wizard's Products step offers. Companies load once; the products
 * of a company and the funds of (company, product type) load on demand and are kept, so each list is fetched once.
 * A failed fetch leaves that dropdown empty rather than breaking the wizard.
 */
export default function useSalesPackageCatalog() {
  const [companies, setCompanies] = useState([]);
  const [productsByCompany, setProductsByCompany] = useState({});
  const [fundsByKey, setFundsByKey] = useState({});

  useEffect(() => {
    api
      .getSalesPackageCompanies()
      .then(setCompanies)
      .catch(() => {});
  }, []);

  const loadProductsFor = async (companyId) => {
    if (!companyId || productsByCompany[companyId]) return;
    try {
      const list = await api.getSalesPackageProducts(companyId);
      setProductsByCompany((m) => ({ ...m, [companyId]: list }));
    } catch {
      /* leave dropdown empty on failure */
    }
  };

  const loadFundsFor = async (companyId, investmentType) => {
    const key = `${companyId}-${investmentType}`;
    if (!companyId || !investmentType || fundsByKey[key]) return;
    try {
      const list = await api.getSalesPackageFunds(companyId, investmentType);
      setFundsByKey((m) => ({ ...m, [key]: list }));
    } catch {
      /* leave dropdown empty on failure */
    }
  };

  return { companies, productsByCompany, fundsByKey, loadProductsFor, loadFundsFor };
}
