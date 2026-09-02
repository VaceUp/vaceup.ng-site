"""Serializers for shopping cart."""

from rest_framework import serializers

from apps.cart.models import Cart, CartItem
from apps.courses.serializers import CourseBasicSerializer


class CartItemSerializer(serializers.ModelSerializer):
    """Read shape for a cart item with course details."""

    course = CourseBasicSerializer(read_only=True)
    effective_price = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    subtotal = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = CartItem
        fields = (
            "id",
            "course",
            "price_override",
            "effective_price",
            "subtotal",
            "created_at",
        )
        read_only_fields = ("course", "effective_price", "subtotal")


class CartItemCreateSerializer(serializers.ModelSerializer):
    """Write shape for adding a course to cart."""

    class Meta:
        model = CartItem
        fields = ("course", "price_override")

    def validate_course(self, course):
        user = self.context["request"].user
        # Check if already enrolled
        from apps.enrollment.models import Enrollment
        if Enrollment.objects.filter(
            student=user, course=course, status=Enrollment.Status.ACTIVE
        ).exists():
            raise serializers.ValidationError("Already enrolled in this course.")
        # Check if already in cart
        from apps.cart.models import Cart
        cart, _ = Cart.objects.get_or_create(user=user)
        if CartItem.objects.filter(cart=cart, course=course).exists():
            raise serializers.ValidationError("Course already in cart.")
        return course

    def create(self, validated_data):
        user = self.context["request"].user
        cart, _ = Cart.objects.get_or_create(user=user)
        validated_data["cart"] = cart
        return super().create(validated_data)


class CartSerializer(serializers.ModelSerializer):
    """Read shape for the full cart."""

    items = CartItemSerializer(many=True, read_only=True)
    item_count = serializers.IntegerField(read_only=True)
    subtotal = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )
    total = serializers.DecimalField(
        max_digits=10, decimal_places=2, read_only=True
    )

    class Meta:
        model = Cart
        fields = (
            "id",
            "items",
            "item_count",
            "subtotal",
            "total",
            "created_at",
        )