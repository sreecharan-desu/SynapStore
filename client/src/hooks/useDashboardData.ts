import { useEffect, useState, useCallback } from "react";
import { useRecoilValue } from "recoil";
import { authState } from "../state/auth";
import { jsonFetch } from "../utils/api";

type DashboardResponse = {
  success: boolean;
  data: any;
};

export const useDashboardData = () => {
  const auth = useRecoilValue(authState);
  const [data, setData] = useState<any | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!auth.token) {
      setError("Missing auth token");
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
      setData(resp.data);
    } catch (err: any) {
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


