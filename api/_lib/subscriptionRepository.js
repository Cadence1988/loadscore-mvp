export function isOlderStripeEvent(currentCreatedAt, incomingCreatedAt) {
  return Number(currentCreatedAt || 0) > Number(incomingCreatedAt || 0);
}

export function createSubscriptionRepository(client) {
  return {
    async findByUser(userId) {
      const { data, error } = await client.from("subscriptions")
        .select("user_id,stripe_customer_id,stripe_subscription_id,stripe_event_created_at")
        .eq("user_id", userId).maybeSingle();
      if (error) throw new Error("subscription_read_failed");
      return data;
    },

    async attachCustomer(userId, customerId) {
      const { data, error } = await client.from("subscriptions")
        .update({ stripe_customer_id: customerId })
        .eq("user_id", userId).is("stripe_customer_id", null)
        .select("user_id,stripe_customer_id").maybeSingle();
      if (error) throw new Error("customer_mapping_failed");
      return data;
    },

    async findUserForStripe({ userId, customerId, subscriptionId }) {
      if (userId) {
        const row = await this.findByUser(userId);
        if (row && (!row.stripe_customer_id || row.stripe_customer_id === customerId)) return row.user_id;
        return null;
      }
      let query = client.from("subscriptions").select("user_id");
      if (subscriptionId) query = query.eq("stripe_subscription_id", subscriptionId);
      else if (customerId) query = query.eq("stripe_customer_id", customerId);
      else return null;
      const { data, error } = await query.maybeSingle();
      if (error) throw new Error("subscription_mapping_failed");
      return data?.user_id || null;
    },

    async claimEvent(event) {
      const { error } = await client.from("stripe_webhook_events").insert({
        stripe_event_id: event.id,
        event_type: event.type,
        stripe_created_at: event.created,
        processing_status: "processing",
      });
      if (!error) return "claimed";
      if (error.code !== "23505") throw new Error("event_claim_failed");
      const { data, error: readError } = await client.from("stripe_webhook_events")
        .select("processing_status").eq("stripe_event_id", event.id).single();
      if (readError) throw new Error("event_claim_read_failed");
      if (data.processing_status === "succeeded" || data.processing_status === "ignored") return "duplicate";
      if (data.processing_status === "processing") return "in_progress";
      const { error: retryError } = await client.from("stripe_webhook_events")
        .update({ processing_status: "processing", safe_error_code: null })
        .eq("stripe_event_id", event.id);
      if (retryError) throw new Error("event_retry_failed");
      return "retry";
    },

    async applySubscription(userId, record, eventId) {
      const current = await this.findByUser(userId);
      if (!current) throw new Error("subscription_owner_missing");
      if (isOlderStripeEvent(current.stripe_event_created_at, record.stripe_event_created_at)) return "older_event";
      const { data, error } = await client.from("subscriptions")
        .update({ ...record, stripe_event_id: eventId })
        .eq("user_id", userId)
        .lte("stripe_event_created_at", record.stripe_event_created_at)
        .select("user_id").maybeSingle();
      if (error) throw new Error("subscription_update_failed");
      return data ? "updated" : "older_event";
    },

    async finishEvent(eventId, status, safeErrorCode = null) {
      const { error } = await client.from("stripe_webhook_events").update({
        processing_status: status,
        safe_error_code: safeErrorCode,
        processed_at: new Date().toISOString(),
      }).eq("stripe_event_id", eventId);
      if (error) throw new Error("event_finish_failed");
    },
  };
}
