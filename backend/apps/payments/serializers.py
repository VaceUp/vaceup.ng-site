"""Serializers for the payments API."""
from rest_framework import serializers

from apps.cart.models import CartItem
from apps.courses.models import Course
from apps.payments.models import Payment, PaymentItem


class PaymentItemSerializer(serializers.ModelSerializer):
    class Meta:
        model = PaymentItem
        fields = ("course", "course_title", "amount")
        read_only_fields = fields


class PaymentSerializer(serializers.ModelSerializer):
    """Read shape returned to the student."""

    course_title = serializers.CharField(source="course.title", read_only=True)
    items = PaymentItemSerializer(many=True, read_only=True)

    class Meta:
        model = Payment
        fields = (
            "reference",
            "course",
            "course_title",
            "amount",
            "currency",
            "status",
            "authorization_url",
            "paid_at",
            "created_at",
            "items",
        )
        read_only_fields = fields


class InitializePaymentSerializer(serializers.Serializer):
    """Write shape: start a checkout for a (paid, published) course."""

    course = serializers.PrimaryKeyRelatedField(
        queryset=Course.objects.filter(is_published=True)
    )
    expected_total = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False)


class VerifyPaymentSerializer(serializers.Serializer):
    """Write shape: verify a payment by its reference (from the callback)."""

    reference = serializers.CharField(max_length=64)


class CartCheckoutSerializer(serializers.Serializer):
    """Write shape: checkout for cart items."""

    cart_items = serializers.ListField(
        child=serializers.IntegerField(min_value=1),
        min_length=1,
        max_length=20,
        help_text="List of CartItem IDs to checkout"
    )
    expected_total = serializers.DecimalField(max_digits=10, decimal_places=2, min_value=0, required=False)

    def validate_cart_items(self, value):
        user = self.context["request"].user
        items = CartItem.objects.filter(cart__user=user, id__in=value)
        if len(set(value)) != len(value) or items.count() != len(value):
            raise serializers.ValidationError("Some cart items not found or not yours.")
        return value


class CartVerifyPaymentSerializer(serializers.Serializer):
    """Write shape: verify a cart-based payment by reference."""

    reference = serializers.CharField(max_length=64)
