import { useEffect, useState, useCallback } from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";
import { useLogout } from "./useLogout";

type DashboardResponse = {
  success: boolean;
  data: any;
  error?: string;
};

export const useDashboardData = () => {
  const auth = useRecoilValue(authState);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const logout = useLogout();

  const load = useCallback(async () => {
    if (!auth.token) {
      setError("Missing auth token");
      window.location.replace("/");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const resp = await jsonFetch<DashboardResponse>(
        "/api/v1/dashboard/bootstrap",
        {
          method: "GET",
          token: auth.token,
        }
      );

      if (resp?.error === "user not found") {
        logout();
        setError("User not found");
        setLoading(false);
        return;
      }

      setData(resp.data);
    } catch (err: any) {
      if (err.message === "user not found") {
        logout();
        return;
      }
      setError(err.message || "Failed to load dashboard");
    } finally {
      setLoading(false);
    }
  }, [auth.token]);

  useEffect(() => {
    load();
  }, [load]);

  return { data, loading, error, refresh: load };
};
