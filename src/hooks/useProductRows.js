import { INVESTMENT_BEARING_TYPES } from "../lib/salesPackageOptions";
import { emptyAllocation, emptyProduct } from "../lib/salesPackage/wizard";

/**
 * Editing the Products step's rows and their fund allocations. Choosing a company or a product clears whatever depended
 * on the old choice (product, account type, allocations) and asks the catalog for the new dropdown lists.
 */
export default function useProductRows({ draft, catalog }) {
  const { data, patch } = draft;
  const { companies, productsByCompany, loadProductsFor, loadFundsFor } = catalog;

  const updateProduct = (id, fields) => patch({ products: data.products.map((p) => (p.id === id ? { ...p, ...fields } : p)) });
  const addProduct = () => patch({ products: [...data.products, emptyProduct()] });
  const removeProduct = (id) => patch({ products: data.products.length > 1 ? data.products.filter((p) => p.id !== id) : data.products });

  const changeCompany = (rowId, companyId) => {
    const company = companies.find((c) => String(c.id) === String(companyId));
    updateProduct(rowId, {
      companyId,
      company: company?.name || "",
      productId: "",
      productName: "",
      type: "",
      accountType: "",
      allocations: [],
    });
    loadProductsFor(companyId);
  };

  const changeProduct = (rowId, productId) => {
    const row = data.products.find((p) => p.id === rowId);
    const list = productsByCompany[row.companyId] || [];
    const product = list.find((p) => String(p.id) === String(productId));
    updateProduct(rowId, {
      productId,
      productName: product?.name || "",
      type: product?.type || "",
      accountType: "",
      allocations: [],
    });
    if (product && INVESTMENT_BEARING_TYPES.has(product.type)) {
      loadFundsFor(row.companyId, product.type);
    }
  };

  const addAllocation = (rowId) => {
    const row = data.products.find((p) => p.id === rowId);
    updateProduct(rowId, { allocations: [...row.allocations, emptyAllocation()] });
  };
  const updateAllocation = (rowId, allocId, fields) => {
    const row = data.products.find((p) => p.id === rowId);
    updateProduct(rowId, { allocations: row.allocations.map((a) => (a.id === allocId ? { ...a, ...fields } : a)) });
  };
  const removeAllocation = (rowId, allocId) => {
    const row = data.products.find((p) => p.id === rowId);
    updateProduct(rowId, { allocations: row.allocations.filter((a) => a.id !== allocId) });
  };

  return { updateProduct, addProduct, removeProduct, changeCompany, changeProduct, addAllocation, updateAllocation, removeAllocation };
}
