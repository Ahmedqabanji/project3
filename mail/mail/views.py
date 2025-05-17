import json
from django.contrib.auth import authenticate, login, logout
from django.contrib.auth.decorators import login_required
from django.db import IntegrityError
from django.http import JsonResponse, HttpResponse, HttpResponseRedirect
from django.shortcuts import render
from django.urls import reverse
from django.views.decorators.csrf import csrf_exempt

from .models import User, Email


def index(request):
    if request.user.is_authenticated:
        return render(request, "mail/inbox.html")
    else:
        return HttpResponseRedirect(reverse("login"))

@csrf_exempt
@login_required
def compose(request):
    if request.method == "POST":
        data = json.loads(request.body)

        # Get recipients
        recipients = [email.strip() for email in data.get("recipients", "").split(",") if email.strip()]
        if not recipients:
            return JsonResponse({"error": "At least one recipient is required."}, status=400)

        try:
            users = User.objects.filter(email__in=recipients)
            if users.count() != len(recipients):
                return JsonResponse({"error": "One or more recipients are invalid."}, status=400)
        except:
            return JsonResponse({"error": "Invalid recipient."}, status=400)

        # Create email
        email = Email.objects.create(
            user=request.user,  # fix here
            sender=request.user,
            subject=data.get("subject", ""),
            body=data.get("body", "")
        )
        for user in users:
            email.recipients.add(user)

        return JsonResponse({"message": "Email sent successfully."}, status=201)

    return JsonResponse({"error": "POST request required."}, status=400)

@login_required
def mailbox(request, mailbox):
    user = request.user

    # Select emails based on mailbox
    if mailbox == "inbox":
        emails = Email.objects.filter(
            recipients=user, archived=False
        )
    elif mailbox == "sent":
        emails = Email.objects.filter(
            sender=user
        )
    elif mailbox == "archive":
        emails = Email.objects.filter(
            recipients=user, archived=True
        )
    else:
        return JsonResponse({"error": "Invalid mailbox."}, status=400)

    # Return serialized emails in reverse chronological order
    return JsonResponse([email.serialize() for email in emails.order_by("-timestamp")], safe=False)

@csrf_exempt
@login_required
def email(request, email_id):
    try:
        email = Email.objects.get(pk=email_id)
        if request.user != email.sender and request.user not in email.recipients.all():
            return JsonResponse({"error": "Access denied."}, status=403)
    except Email.DoesNotExist:
        return JsonResponse({"error": "Email not found."}, status=404)

    if request.method == "GET":
        return JsonResponse(email.serialize())

    elif request.method == "PUT":
        data = json.loads(request.body)
        if data.get("read") is not None:
            email.read = data["read"]
        if data.get("archived") is not None:
            email.archived = data["archived"]
        email.save()
        return HttpResponse(status=204)

    else:
        return JsonResponse({"error": "GET or PUT request required."}, status=400)


def login_view(request):
    if request.method == "POST":
        username = request.POST["username"]

        password = request.POST["password"]
        user = authenticate(request, username=username, password=password)


        if user is not None:
            login(request, user)
            return HttpResponseRedirect(reverse("index"))
        else:
            return render(request, "mail/login.html", {"message": "Invalid email and/or password."})
    else:
        return render(request, "mail/login.html")


def logout_view(request):
    logout(request)
    return HttpResponseRedirect(reverse("index"))


def register(request):
    if request.method == "POST":
        username = request.POST["username"]
        email = request.POST["email"]
        password = request.POST["password"]
        confirmation = request.POST["confirmation"]

        if password != confirmation:
            return render(request, "mail/register.html", {"message": "Passwords must match."})

        try:
            # إنشاء المستخدم باستخدام username و email
            user = User(username=username, email=email)
            user.set_password(password)
            user.save()
        except IntegrityError:
            return render(request, "mail/register.html", {"message": "Username already taken."})

        login(request, user)
        return HttpResponseRedirect(reverse("index"))

    else:
        return render(request, "mail/register.html")
